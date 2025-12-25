// src/modules/provider/opportunities/recommended-service.js
import { prisma } from "./model.js";
import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";

// In-memory cache for recommendations (providerId -> { recommendations, cachedAt })
const recommendationsCache = new Map();

const CACHE_DURATION_MS = 2 * 60 * 60 * 1000; // 2 hours in milliseconds

/**
 * Calculate match score between provider and service request
 * Based on skills overlap and category match
 */
function calculateMatchScore(providerProfile, serviceRequest) {
  let score = 0;
  const maxScore = 100;

  // Skills overlap (70% weight)
  const providerSkills = (providerProfile.skills || []).map(s => s.toLowerCase());
  const requestSkills = (serviceRequest.skills || []).map(s => s.toLowerCase());
  
  if (requestSkills.length > 0) {
    const matchingSkills = requestSkills.filter(skill => 
      providerSkills.some(ps => ps.includes(skill) || skill.includes(ps))
    );
    const skillsScore = (matchingSkills.length / requestSkills.length) * 70;
    score += skillsScore;
  } else {
    // If no skills specified, give neutral score
    score += 35;
  }

  // Category match (30% weight)
  if (providerProfile.major && serviceRequest.category) {
    const providerMajor = providerProfile.major.toLowerCase();
    const requestCategory = serviceRequest.category.toLowerCase();
    
    // Exact match
    if (providerMajor === requestCategory || providerMajor.includes(requestCategory) || requestCategory.includes(providerMajor)) {
      score += 30;
    } else {
      // Partial match (some categories are related)
      const categoryKeywords = {
        'web': ['web', 'frontend', 'backend', 'fullstack'],
        'mobile': ['mobile', 'app', 'ios', 'android'],
        'cloud': ['cloud', 'aws', 'azure', 'devops'],
        'ai': ['ai', 'ml', 'machine learning', 'artificial intelligence'],
        'data': ['data', 'analytics', 'database'],
        'design': ['design', 'ui', 'ux'],
      };
      
      let foundMatch = false;
      for (const [key, keywords] of Object.entries(categoryKeywords)) {
        if (keywords.some(k => providerMajor.includes(k) || requestCategory.includes(k))) {
          score += 15; // Partial match
          foundMatch = true;
          break;
        }
      }
      
      if (!foundMatch) {
        score += 5; // Minimal match
      }
    }
  } else {
    // If no category info, give neutral score
    score += 15;
  }

  return Math.min(Math.round(score), maxScore);
}

/**
 * Get cached recommendations if still valid
 */
function getCachedRecommendations(providerId) {
  const cached = recommendationsCache.get(providerId);
  if (!cached) return null;

  const now = Date.now();
  const age = now - cached.cachedAt;

  if (age < CACHE_DURATION_MS) {
    return {
      recommendations: cached.recommendations,
      cachedAt: cached.cachedAt,
      nextRefreshAt: cached.cachedAt + CACHE_DURATION_MS,
    };
  }

  // Cache expired, remove it
  recommendationsCache.delete(providerId);
  return null;
}

/**
 * Cache recommendations
 */
function setCachedRecommendations(providerId, recommendations) {
  recommendationsCache.set(providerId, {
    recommendations,
    cachedAt: Date.now(),
  });
}

/**
 * Generate AI explanation for why an opportunity is recommended
 */
async function generateAIExplanation(providerProfile, serviceRequest, matchScore) {
  try {
    const model = new ChatOpenAI({
      modelName: "gpt-4o",
      temperature: 0.7,
      openAIApiKey: process.env.OPENAI_API_KEY,
    });

    const prompt = PromptTemplate.fromTemplate(`
You are an AI assistant helping a freelance provider understand why a specific opportunity is recommended for them.

Provider Profile:
- Skills: {providerSkills}
- Major/Category: {providerMajor}
- Years of Experience: {yearsExperience}
- Hourly Rate: {hourlyRate}
- Availability: {availability}
- Location: {location}
- Preferred Project Duration: {preferredDuration}
- Work Preference: {workPreference}
- Minimum Budget: {minBudget}
- Maximum Budget: {maxBudget}

Service Request:
- Title: {requestTitle}
- Description: {requestDescription}
- Category: {requestCategory}
- Required Skills: {requestSkills}
- Budget Range: RM {budgetMin} - RM {budgetMax}
- Timeline: {timeline}
- Priority: {priority}

Match Score: {matchScore}/100

Generate a clear, concise explanation in bullet point format. Use simple bullet points (• or -) to list key points.

Structure your response as follows:
• Start with 2-3 positive points explaining why this is a good match (skills alignment, budget fit, timeline compatibility, experience match, etc.)
• Then list 1-2 potential concerns or considerations (tight deadline, budget mismatch, unclear scope, etc.) if any exist

Guidelines:
- Be specific and actionable
- Use clear, simple language
- Keep each bullet point to one sentence
- Focus on the most important factors
- If there are no significant concerns, only list positives
- Be honest and balanced

Format: Use bullet points (•) separated by newlines. Return ONLY the bullet points text, no markdown formatting, no code blocks, no quotes, no headers.
`);

    const chain = RunnableSequence.from([prompt, model]);
    
    const result = await chain.invoke({
      providerSkills: (providerProfile.skills || []).join(", ") || "Not specified",
      providerMajor: providerProfile.major || "Not specified",
      yearsExperience: providerProfile.yearsExperience?.toString() || "Not specified",
      hourlyRate: providerProfile.hourlyRate?.toString() || "Not specified",
      availability: providerProfile.availability || "Not specified",
      location: providerProfile.location || "Not specified",
      preferredDuration: providerProfile.preferredProjectDuration || "Not specified",
      workPreference: providerProfile.workPreference || "Not specified",
      minBudget: providerProfile.minimumProjectBudget?.toString() || "Not specified",
      maxBudget: providerProfile.maximumProjectBudget?.toString() || "Not specified",
      requestTitle: serviceRequest.title,
      requestDescription: serviceRequest.description || "No description",
      requestCategory: serviceRequest.category || "Not specified",
      requestSkills: (serviceRequest.skills || []).join(", ") || "Not specified",
      budgetMin: serviceRequest.budgetMin?.toString() || "0",
      budgetMax: serviceRequest.budgetMax?.toString() || "0",
      timeline: serviceRequest.timeline || "Not specified",
      priority: serviceRequest.priority || "Not specified",
      matchScore: matchScore.toString(),
    });

    let content = result.content?.trim() || "";
    
    // Clean up any markdown or code fences
    if (content.startsWith("```")) {
      content = content.replace(/```[\w]*/g, "").trim();
    }
    if (content.startsWith('"') && content.endsWith('"')) {
      content = content.slice(1, -1);
    }
    
    // Ensure bullet points are properly formatted
    // Replace various bullet point formats with consistent • format
    content = content
      .replace(/^[-*]\s+/gm, "• ") // Replace - or * with •
      .replace(/^\d+\.\s+/gm, "• ") // Replace numbered lists with bullets
      .replace(/^•\s*/gm, "• ") // Ensure consistent bullet format
      .trim();

    return content;
  } catch (error) {
    console.error("Error generating AI explanation:", error);
    // Return a fallback explanation in bullet point format
    const topSkills = (serviceRequest.skills || []).slice(0, 2).join(", ");
    return `• This opportunity matches your skills in ${topSkills || "your expertise area"}\n• The project falls within your category expertise\n• Review the budget and timeline to ensure it aligns with your availability`;
  }
}

/**
 * Get recommended opportunities for a provider
 */
export async function getRecommendedOpportunities(providerId) {
  try {
    // Check cache first
    const cached = getCachedRecommendations(providerId);
    if (cached) {
      return {
        recommendations: cached.recommendations,
        cachedAt: cached.cachedAt,
        nextRefreshAt: cached.nextRefreshAt,
        isCached: true,
      };
    }

    // Get provider profile
    const providerProfile = await prisma.providerProfile.findUnique({
      where: { userId: providerId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!providerProfile) {
      throw new Error("Provider profile not found");
    }

    // Get all open service requests (excluding ones from the same provider)
    const allServiceRequests = await prisma.serviceRequest.findMany({
      where: {
        status: "OPEN",
        NOT: {
          customerId: providerId, // Exclude own requests
        },
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            isVerified: true,
            customerProfile: {
              select: {
                companySize: true,
                industry: true,
                location: true,
                website: true,
                profileImageUrl: true,
                totalSpend: true,
                projectsPosted: true,
              },
            },
          },
        },
        _count: {
          select: {
            proposals: true,
          },
        },
      },
    });

    // Check which service requests the provider has already proposed to
    const serviceRequestIds = allServiceRequests.map(sr => sr.id);
    const existingProposals = await prisma.proposal.findMany({
      where: {
        providerId: providerId,
        serviceRequestId: {
          in: serviceRequestIds,
        },
      },
      select: {
        serviceRequestId: true,
      },
    });

    const proposedServiceRequestIds = new Set(existingProposals.map(p => p.serviceRequestId));

    // Filter out already proposed requests and calculate match scores
    const scoredRequests = allServiceRequests
      .filter(sr => !proposedServiceRequestIds.has(sr.id))
      .map(sr => ({
        serviceRequest: sr,
        matchScore: calculateMatchScore(providerProfile, sr),
      }))
      .sort((a, b) => b.matchScore - a.matchScore) // Sort by match score descending
      .slice(0, 5); // Take top 5

    // Generate AI explanations for each recommendation
    const recommendations = await Promise.all(
      scoredRequests.map(async ({ serviceRequest, matchScore }) => {
        const explanation = await generateAIExplanation(
          providerProfile,
          serviceRequest,
          matchScore
        );

        return {
          id: serviceRequest.id,
          title: serviceRequest.title,
          description: serviceRequest.description,
          category: serviceRequest.category,
          budgetMin: serviceRequest.budgetMin,
          budgetMax: serviceRequest.budgetMax,
          skills: serviceRequest.skills,
          timeline: serviceRequest.timeline,
          priority: serviceRequest.priority,
          status: serviceRequest.status,
          createdAt: serviceRequest.createdAt,
          customer: serviceRequest.customer,
          proposalCount: serviceRequest._count.proposals,
          matchScore,
          aiExplanation: explanation,
        };
      })
    );

    // Cache the recommendations
    const cachedAt = Date.now();
    const nextRefreshAt = cachedAt + CACHE_DURATION_MS;
    setCachedRecommendations(providerId, recommendations);

    return {
      recommendations,
      cachedAt,
      nextRefreshAt,
      isCached: false,
    };
  } catch (error) {
    console.error("Error fetching recommended opportunities:", error);
    throw new Error("Failed to fetch recommended opportunities");
  }
}

