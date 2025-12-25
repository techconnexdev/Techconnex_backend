// src/modules/company/find-providers/recommended-service.js
import { prisma } from "./model.js";
import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";

// In-memory cache for recommendations (customerId -> { recommendations, cachedAt })
const recommendationsCache = new Map();

const CACHE_DURATION_MS = 2 * 60 * 60 * 1000; // 2 hours in milliseconds

/**
 * Calculate match score between provider and service request
 * Based on skills overlap, category match, budget compatibility, and timeline fit
 */
function calculateMatchScore(providerProfile, serviceRequest) {
  let score = 0;
  const maxScore = 100;

  // Skills overlap (40% weight)
  const providerSkills = (providerProfile.skills || []).map((s) =>
    s.toLowerCase()
  );
  const requestSkills = (serviceRequest.skills || []).map((s) =>
    s.toLowerCase()
  );

  if (requestSkills.length > 0) {
    const matchingSkills = requestSkills.filter((skill) =>
      providerSkills.some((ps) => ps.includes(skill) || skill.includes(ps))
    );
    const skillsScore = (matchingSkills.length / requestSkills.length) * 40;
    score += skillsScore;
  } else {
    score += 20; // Neutral score if no skills specified
  }

  // Category match (20% weight)
  if (providerProfile.major && serviceRequest.category) {
    const providerMajor = providerProfile.major.toLowerCase();
    const requestCategory = serviceRequest.category.toLowerCase();

    if (
      providerMajor === requestCategory ||
      providerMajor.includes(requestCategory) ||
      requestCategory.includes(providerMajor)
    ) {
      score += 20;
    } else {
      const categoryKeywords = {
        web: ["web", "frontend", "backend", "fullstack"],
        mobile: ["mobile", "app", "ios", "android"],
        cloud: ["cloud", "aws", "azure", "devops"],
        ai: ["ai", "ml", "machine learning", "artificial intelligence"],
        data: ["data", "analytics", "database"],
        design: ["design", "ui", "ux"],
      };

      let foundMatch = false;
      for (const [key, keywords] of Object.entries(categoryKeywords)) {
        if (
          keywords.some(
            (k) => providerMajor.includes(k) || requestCategory.includes(k)
          )
        ) {
          score += 10; // Partial match
          foundMatch = true;
          break;
        }
      }

      if (!foundMatch) {
        score += 3; // Minimal match
      }
    }
  } else {
    score += 10; // Neutral score
  }

  // Budget compatibility (20% weight)
  const requestBudgetMin = serviceRequest.budgetMin || 0;
  const requestBudgetMax = serviceRequest.budgetMax || Infinity;
  const providerMinBudget = providerProfile.minimumProjectBudget || 0;
  const providerMaxBudget = providerProfile.maximumProjectBudget || Infinity;
  const providerHourlyRate = providerProfile.hourlyRate || 0;

  // Check if budgets overlap
  if (
    providerMinBudget <= requestBudgetMax &&
    providerMaxBudget >= requestBudgetMin
  ) {
    score += 20; // Budgets are compatible
  } else if (providerHourlyRate > 0) {
    // Estimate based on hourly rate (rough estimate: 40 hours for small, 200 for large)
    const estimatedMin = providerHourlyRate * 40;
    const estimatedMax = providerHourlyRate * 200;
    if (estimatedMin <= requestBudgetMax && estimatedMax >= requestBudgetMin) {
      score += 15; // Estimated budget compatibility
    } else {
      score += 5; // Budget mismatch
    }
  } else {
    score += 10; // No budget info, neutral
  }

  // Timeline & availability fit (20% weight)
  if (serviceRequest.timeline && providerProfile.availability) {
    const timeline = serviceRequest.timeline.toLowerCase();
    const availability = providerProfile.availability.toLowerCase();

    // Check for urgency indicators
    const urgentKeywords = ["urgent", "asap", "immediate", "quick", "fast"];
    const isUrgent = urgentKeywords.some((keyword) =>
      timeline.includes(keyword)
    );

    if (
      isUrgent &&
      (availability.includes("available") || availability.includes("immediate"))
    ) {
      score += 20; // Perfect match for urgent projects
    } else if (!isUrgent && availability.includes("available")) {
      score += 15; // Good match
    } else {
      score += 8; // Partial match
    }
  } else {
    score += 10; // Neutral score
  }

  return Math.min(Math.round(score), maxScore);
}

/**
 * Get cached recommendations if still valid
 */
function getCachedRecommendations(customerId) {
  const cached = recommendationsCache.get(customerId);
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
  recommendationsCache.delete(customerId);
  return null;
}

/**
 * Cache recommendations
 */
function setCachedRecommendations(customerId, recommendations) {
  recommendationsCache.set(customerId, {
    recommendations,
    cachedAt: Date.now(),
  });
}

/**
 * Generate AI explanation for why a provider is recommended
 */
async function generateAIExplanation(
  providerProfile,
  serviceRequest,
  matchScore,
  isVerified
) {
  try {
    const model = new ChatOpenAI({
      modelName: "gpt-4o",
      temperature: 0.7,
      openAIApiKey: process.env.OPENAI_API_KEY,
    });

    const prompt = PromptTemplate.fromTemplate(`
You are an AI assistant helping a company understand why a specific provider is recommended for their service request.

Provider Profile:
- Name: {providerName}
- Skills: {providerSkills}
- Major/Category: {providerMajor}
- Rating: {rating}/5.0
- Years of Experience: {yearsExperience}
- Hourly Rate: RM {hourlyRate}
- Availability: {availability}
- Location: {location}
- Preferred Project Duration: {preferredDuration}
- Work Preference: {workPreference}
- Minimum Budget: RM {minBudget}
- Maximum Budget: RM {maxBudget}
- Total Projects Completed: {totalProjects}
- Success Rate: {successRate}%
- Response Time: {responseTime} hours
- Is Verified: {isVerified} (verified means they uploaded official identity documents)

Service Request:
- Title: {requestTitle}
- Description: {requestDescription}
- Category: {requestCategory}
- Required Skills: {requestSkills}
- Budget Range: RM {budgetMin} - RM {budgetMax}
- Timeline: {timeline}
- Priority: {priority}

Match Score: {matchScore}/100

Generate a clear, concise explanation in bullet point format. Use simple bullet points (•) to list key points.

Structure your response as follows:
• Start with 2-3 positive points explaining why this provider is a good match (skills alignment, experience, rating, budget fit, timeline compatibility, etc.)
• Clearly state which specific ServiceRequest/project they are most suitable for: "{requestTitle}"
• List 1-2 potential concerns or considerations (budget mismatch, availability, timeline constraints, etc.) if any exist
• IMPORTANT: If isVerified is false, add a warning bullet point: "⚠️ Warning: This provider has not uploaded official identity documents for verification"

Guidelines:
- Be specific and actionable
- Use clear, simple language
- Keep each bullet point to one sentence
- Focus on the most important factors
- If there are no significant concerns, only list positives (except verification warning if applicable)
- Be honest and balanced
- Always mention the specific ServiceRequest title they're recommended for

Format: Use bullet points (•) separated by newlines. Return ONLY the bullet points text, no markdown formatting, no code blocks, no quotes, no headers.
`);

    const chain = RunnableSequence.from([prompt, model]);

    const result = await chain.invoke({
      providerName: providerProfile.user?.name || "Provider",
      providerSkills:
        (providerProfile.skills || []).join(", ") || "Not specified",
      providerMajor: providerProfile.major || "Not specified",
      rating: providerProfile.rating?.toString() || "0",
      yearsExperience:
        providerProfile.yearsExperience?.toString() || "Not specified",
      hourlyRate: providerProfile.hourlyRate?.toString() || "Not specified",
      availability: providerProfile.availability || "Not specified",
      location: providerProfile.location || "Not specified",
      preferredDuration:
        providerProfile.preferredProjectDuration || "Not specified",
      workPreference: providerProfile.workPreference || "Not specified",
      minBudget:
        providerProfile.minimumProjectBudget?.toString() || "Not specified",
      maxBudget:
        providerProfile.maximumProjectBudget?.toString() || "Not specified",
      totalProjects: providerProfile.totalProjects?.toString() || "0",
      successRate: providerProfile.successRate?.toString() || "0",
      responseTime: providerProfile.responseTime?.toString() || "24",
      isVerified: isVerified ? "Yes" : "No",
      requestTitle: serviceRequest.title,
      requestDescription: serviceRequest.description || "No description",
      requestCategory: serviceRequest.category || "Not specified",
      requestSkills:
        (serviceRequest.skills || []).join(", ") || "Not specified",
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
    const verificationWarning = !isVerified
      ? "\n• ⚠️ Warning: This provider has not uploaded official identity documents for verification"
      : "";
    return `• This provider matches your skills requirements: ${
      topSkills || "your project needs"
    }\n• Recommended for: "${
      serviceRequest.title
    }"\n• The provider's experience and rating align with your project requirements${verificationWarning}`;
  }
}

/**
 * Get recommended providers for a company based on their ServiceRequests
 */
export async function getRecommendedProviders(customerId) {
  try {
    // Check cache first
    const cached = getCachedRecommendations(customerId);
    if (cached) {
      return {
        recommendations: cached.recommendations,
        cachedAt: cached.cachedAt,
        nextRefreshAt: cached.nextRefreshAt,
        isCached: true,
      };
    }

    // Get company's open ServiceRequests
    const openServiceRequests = await prisma.serviceRequest.findMany({
      where: {
        customerId: customerId,
        status: "OPEN",
      },
      include: {
        _count: {
          select: {
            proposals: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (openServiceRequests.length === 0) {
      return {
        recommendations: [],
        cachedAt: Date.now(),
        nextRefreshAt: Date.now() + CACHE_DURATION_MS,
        isCached: false,
      };
    }

    // Get all active providers with profiles
    const allProviders = await prisma.user.findMany({
      where: {
        role: {
          has: "PROVIDER",
        },
        status: "ACTIVE",
        providerProfile: {
          isNot: null,
        },
      },
      include: {
        providerProfile: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        settings: true,
      },
    });

    // Check which providers have already submitted proposals for these ServiceRequests
    const serviceRequestIds = openServiceRequests.map((sr) => sr.id);
    const existingProposals = await prisma.proposal.findMany({
      where: {
        serviceRequestId: {
          in: serviceRequestIds,
        },
      },
      select: {
        providerId: true,
        serviceRequestId: true,
      },
    });

    // Create a map of providerId -> Set of ServiceRequestIds they've already proposed to
    const providerProposedMap = new Map();
    existingProposals.forEach((proposal) => {
      if (!providerProposedMap.has(proposal.providerId)) {
        providerProposedMap.set(proposal.providerId, new Set());
      }
      providerProposedMap
        .get(proposal.providerId)
        .add(proposal.serviceRequestId);
    });

    // Calculate match scores for each provider against each ServiceRequest
    const providerScores = [];

    for (const provider of allProviders) {
      if (!provider.providerProfile) continue;

      const proposedServiceRequestIds =
        providerProposedMap.get(provider.id) || new Set();

      // Find the best matching ServiceRequest for this provider
      let bestMatch = null;
      let bestScore = 0;

      for (const serviceRequest of openServiceRequests) {
        // Skip if provider already proposed
        if (proposedServiceRequestIds.has(serviceRequest.id)) continue;

        const score = calculateMatchScore(
          provider.providerProfile,
          serviceRequest
        );
        if (score > bestScore) {
          bestScore = score;
          bestMatch = serviceRequest;
        }
      }

      if (bestMatch && bestScore > 0) {
        providerScores.push({
          provider: provider,
          providerProfile: provider.providerProfile,
          serviceRequest: bestMatch,
          matchScore: bestScore,
        });
      }
    }

    // Sort by match score and take top 5
    const topMatches = providerScores
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 5);

    // Generate AI explanations for each recommendation
    const recommendations = await Promise.all(
      topMatches.map(
        async ({ provider, providerProfile, serviceRequest, matchScore }) => {
          const isVerified = provider.isVerified || false;
          const explanation = await generateAIExplanation(
            providerProfile,
            serviceRequest,
            matchScore,
            isVerified
          );

          return {
            profileId: providerProfile.id || null,
            id: provider.id,
            name: provider.name,
            email: provider.email,
            avatar: providerProfile.profileImageUrl || null,
            major: providerProfile.major || "ICT Professional",
            rating: parseFloat(providerProfile.rating || 0),
            reviewCount: providerProfile.totalReviews || 0,
            completedJobs: providerProfile.totalProjects || 0,
            hourlyRate: providerProfile.hourlyRate || 0,
            location: providerProfile.location || "Malaysia",
            bio: providerProfile.bio || "Experienced ICT professional",
            availability: providerProfile.availability || "Available",
            responseTime: providerProfile.responseTime || 24,
            skills: providerProfile.skills || [],
            yearsExperience: providerProfile.yearsExperience || 0,
            minimumProjectBudget: providerProfile.minimumProjectBudget || null,
            maximumProjectBudget: providerProfile.maximumProjectBudget || null,
            preferredProjectDuration:
              providerProfile.preferredProjectDuration || null,
            workPreference: providerProfile.workPreference || "remote",
            successRate: parseFloat(providerProfile.successRate || 0),
            isVerified: isVerified,
            matchScore: matchScore,
            recommendedForServiceRequest: {
              id: serviceRequest.id,
              title: serviceRequest.title,
              description: serviceRequest.description,
              category: serviceRequest.category,
              budgetMin: serviceRequest.budgetMin,
              budgetMax: serviceRequest.budgetMax,
              timeline: serviceRequest.timeline,
              proposalCount: serviceRequest._count.proposals,
            },
            aiExplanation: explanation,
          };
        }
      )
    );

    // Cache the recommendations
    const cachedAt = Date.now();
    const nextRefreshAt = cachedAt + CACHE_DURATION_MS;
    setCachedRecommendations(customerId, recommendations);

    return {
      recommendations,
      cachedAt,
      nextRefreshAt,
      isCached: false,
    };
  } catch (error) {
    console.error("Error fetching recommended providers:", error);
    throw new Error("Failed to fetch recommended providers");
  }
}
