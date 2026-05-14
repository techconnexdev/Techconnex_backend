// src/modules/company/find-providers/recommended-service.js
import { prisma } from "./model.js";
import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { calculateMatchScore } from "../../../shared/recommendation-match-score.js";
import {
  aiLocaleLanguage,
  normalizeAiLocale,
} from "../../../utils/aiDraftLocale.js";

// In-memory cache for recommendations (customerId or "customerId:serviceRequestId" -> { recommendations, cachedAt })
const recommendationsCache = new Map();

const CACHE_DURATION_MS = 2 * 60 * 60 * 1000; // 2 hours in milliseconds

/** Max characters for request description in AI prompt to avoid long context. */
const MAX_REQUEST_DESCRIPTION_LENGTH = 500;

/**
 * Get cached recommendations if still valid
 */
function getCachedRecommendations(cacheKey) {
  const cached = recommendationsCache.get(cacheKey);
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
  recommendationsCache.delete(cacheKey);
  return null;
}

/**
 * Cache recommendations
 */
function setCachedRecommendations(cacheKey, recommendations) {
  recommendationsCache.set(cacheKey, {
    recommendations,
    cachedAt: Date.now(),
  });
}

/**
 * Update a provider's mutable fields in the recommendations cache in-place.
 * AI explanations (aiExplanation) are kept to avoid regenerating them and consuming tokens.
 * @param {string} providerId - Provider user id
 * @param {object} updates - Fields to patch (availability, hourlyRate, location, bio, skills, etc.)
 */
export function updateProviderInRecommendationsCache(providerId, updates) {
  if (!providerId || !updates || Object.keys(updates).length === 0) return;
  const patchableKeys = new Set([
    "availability",
    "hourlyRate",
    "location",
    "bio",
    "skills",
    "yearsExperience",
    "minimumProjectBudget",
    "maximumProjectBudget",
    "preferredProjectDuration",
    "workPreference",
    "successRate",
    "avatar",
  ]);
  for (const [, value] of recommendationsCache.entries()) {
    if (value?.recommendations && Array.isArray(value.recommendations)) {
      for (const rec of value.recommendations) {
        if (rec.id === providerId) {
          for (const [key, val] of Object.entries(updates)) {
            if (patchableKeys.has(key) && val !== undefined) {
              rec[key] = val;
            }
          }
        }
      }
    }
  }
}

/**
 * Generate AI explanation for why a provider is recommended
 */
async function generateAIExplanation(
  providerProfile,
  serviceRequest,
  matchScore,
  isVerified,
  locale = "en",
) {
  try {
    const model = new ChatOpenAI({
      modelName: "gpt-4o",
      temperature: 0.7,
      openAIApiKey: process.env.OPENAI_API_KEY,
    });

    const prompt = PromptTemplate.fromTemplate(`
You are an AI assistant helping a company understand why a specific provider is recommended for their service request.
Output language: {outputLanguage}. Keep names, numbers, and currency codes unchanged.

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

    const rawDescription = serviceRequest.description || "No description";
    const requestDescription =
      rawDescription.length > MAX_REQUEST_DESCRIPTION_LENGTH
        ? rawDescription.slice(0, MAX_REQUEST_DESCRIPTION_LENGTH) + "..."
        : rawDescription;

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
      requestDescription,
      requestCategory: serviceRequest.category || "Not specified",
      requestSkills:
        (serviceRequest.skills || []).join(", ") || "Not specified",
      budgetMin: serviceRequest.budgetMin?.toString() || "0",
      budgetMax: serviceRequest.budgetMax?.toString() || "0",
      timeline: serviceRequest.timeline || "Not specified",
      priority: serviceRequest.priority || "Not specified",
      matchScore: matchScore.toString(),
      outputLanguage: aiLocaleLanguage(locale),
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
    if (locale === "id") {
      return `• Penyedia ini sesuai dengan kebutuhan skill proyek Anda: ${topSkills || "kebutuhan proyek Anda"}\n• Direkomendasikan untuk: "${serviceRequest.title}"\n• Pengalaman dan rating penyedia selaras dengan kebutuhan proyek Anda${verificationWarning}`;
    }
    if (locale === "ar") {
      return `• هذا المزود يطابق متطلبات المهارات في مشروعك: ${topSkills || "احتياجات مشروعك"}\n• موصى به من أجل: "${serviceRequest.title}"\n• خبرة المزود وتقييمه يتوافقان مع متطلبات مشروعك${verificationWarning}`;
    }
    return `• This provider matches your skills requirements: ${topSkills || "your project needs"}\n• Recommended for: "${serviceRequest.title}"\n• The provider's experience and rating align with your project requirements${verificationWarning}`;
  }
}

/**
 * Get recommended providers for a company based on their ServiceRequests.
 * @param {string} customerId - Company/customer user id
 * @param {string} [serviceRequestId] - Optional. If provided, return top 5 providers for this request only (same algorithm).
 */
export async function getRecommendedProviders(
  customerId,
  serviceRequestId,
  locale = "en",
) {
  const outputLocale = normalizeAiLocale(locale);
  const cacheKey = serviceRequestId
    ? `${customerId}:${serviceRequestId}:${outputLocale}`
    : `${customerId}:${outputLocale}`;

  try {
    // Check cache first (2-hour TTL for both global and per-service-request, same as AI find providers)
    const cached = getCachedRecommendations(cacheKey);
    if (cached) {
      return {
        recommendations: cached.recommendations,
        cachedAt: cached.cachedAt,
        nextRefreshAt: cached.nextRefreshAt,
        isCached: true,
      };
    }

    // Get company's open ServiceRequests (one or all)
    const where = {
      customerId: customerId,
      status: "OPEN",
    };
    if (serviceRequestId) {
      where.id = serviceRequestId;
    }

    const openServiceRequests = await prisma.serviceRequest.findMany({
      where,
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

    const providerProposedMap = new Map();
    existingProposals.forEach((proposal) => {
      if (!providerProposedMap.has(proposal.providerId)) {
        providerProposedMap.set(proposal.providerId, new Set());
      }
      providerProposedMap
        .get(proposal.providerId)
        .add(proposal.serviceRequestId);
    });

    const providerScores = [];

    for (const provider of allProviders) {
      if (!provider.providerProfile) continue;

      const proposedServiceRequestIds =
        providerProposedMap.get(provider.id) || new Set();

      let bestMatch = null;
      let bestScore = 0;

      for (const serviceRequest of openServiceRequests) {
        if (proposedServiceRequestIds.has(serviceRequest.id)) continue;

        const score = calculateMatchScore(
          provider.providerProfile,
          serviceRequest,
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

    const topMatches = providerScores
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 5);

    // Generate AI explanations for each recommendation
    const recommendations = await Promise.all(
      topMatches.map(
        async ({ provider, providerProfile, serviceRequest, matchScore }) => {
          const isVerified = provider.isVerified || false;
          const settings = provider.settings || {};
          const allowMessages = settings.allowMessages !== false;
          const prefCurRaw = settings.preferredCurrency;
          const preferredCurrency =
            typeof prefCurRaw === "string" &&
            /^[A-Z]{3}$/i.test(prefCurRaw.trim())
              ? prefCurRaw.trim().toUpperCase()
              : "MYR";
          const explanation = await generateAIExplanation(
            providerProfile,
            serviceRequest,
            matchScore,
            isVerified,
            outputLocale,
          );

          return {
            profileId: providerProfile.id || null,
            id: provider.id,
            name: provider.name,
            email: provider.email,
            allowMessages,
            preferredCurrency,
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
            pricingFxSnapshotDate: providerProfile.fxSnapshotDate ?? null,
            pricingFxSnapshotSession:
              providerProfile.fxSnapshotSession ?? null,
            pricingFxSnapshotRatesJson:
              providerProfile.fxSnapshotRatesJson ?? null,
          };
        },
      ),
    );

    const cachedAt = Date.now();
    const nextRefreshAt = cachedAt + CACHE_DURATION_MS;
    setCachedRecommendations(cacheKey, recommendations);

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
