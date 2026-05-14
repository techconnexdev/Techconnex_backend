// src/modules/provider/opportunities/recommended-service.js
import { prisma } from "./model.js";
import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { calculateMatchScore } from "../../../shared/recommendation-match-score.js";
import { buildBudgetDisplayData } from "../../fx/service.js";

// In-memory cache for recommendations (providerId:locale -> { recommendations, cachedAt })
const recommendationsCache = new Map();

const CACHE_DURATION_MS = 2 * 60 * 60 * 1000; // 2 hours in milliseconds

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
 * Invalidate cached AI recommendations for a provider (e.g. after submitting a proposal).
 */
export function invalidateRecommendationsCache(providerId) {
  if (!providerId) return;
  for (const key of recommendationsCache.keys()) {
    if (key.startsWith(`${providerId}:`)) {
      recommendationsCache.delete(key);
    }
  }
}

function normalizeOutputLocale(locale) {
  const code = String(locale || "en").trim().toLowerCase();
  if (code.startsWith("id")) return "id";
  if (code.startsWith("ar")) return "ar";
  return "en";
}

function localeLanguageLabel(locale) {
  if (locale === "id") return "Bahasa Indonesia";
  if (locale === "ar") return "Arabic";
  return "English";
}

/**
 * Drop stale entries: not OPEN, own request, or provider already proposed.
 */
async function filterValidRecommendations(providerId, recommendations) {
  if (!Array.isArray(recommendations) || recommendations.length === 0) {
    return [];
  }
  const ids = recommendations.map((r) => r.id).filter(Boolean);
  if (ids.length === 0) return [];

  const [stillOpen, myProposals] = await Promise.all([
    prisma.serviceRequest.findMany({
      where: {
        id: { in: ids },
        status: "OPEN",
        NOT: { customerId: providerId },
      },
      select: { id: true },
    }),
    prisma.proposal.findMany({
      where: {
        providerId,
        serviceRequestId: { in: ids },
      },
      select: { serviceRequestId: true },
    }),
  ]);

  const openIds = new Set(stillOpen.map((s) => s.id));
  const proposedIds = new Set(myProposals.map((p) => p.serviceRequestId));

  return recommendations.filter(
    (r) => r?.id && openIds.has(r.id) && !proposedIds.has(r.id),
  );
}

/**
 * Apply provider preferred currency to budget fields (same as main opportunities list).
 */
async function enrichRecommendationsWithPreferredCurrency(
  providerId,
  recommendations,
) {
  if (!Array.isArray(recommendations) || recommendations.length === 0) {
    return [];
  }
  const settings = await prisma.settings.findUnique({
    where: { userId: providerId },
    select: { preferredCurrency: true },
  });
  const preferredCurrency = settings?.preferredCurrency || "MYR";
  return recommendations.map((r) => ({
    ...r,
    ...buildBudgetDisplayData(
      {
        budgetMin: r.budgetMin,
        budgetMax: r.budgetMax,
        currencyCode: r.currencyCode || "MYR",
        fxSnapshotRatesJson: r.fxSnapshotRatesJson ?? null,
        fxSnapshotDate: r.fxSnapshotDate,
        fxSnapshotSession: r.fxSnapshotSession,
      },
      preferredCurrency,
    ),
  }));
}

/**
 * Generate AI explanation for why an opportunity is recommended
 */
async function generateAIExplanation(
  providerProfile,
  serviceRequest,
  matchScore,
  outputLocale = "en",
) {
  try {
    const model = new ChatOpenAI({
      modelName: "gpt-4o",
      temperature: 0.7,
      openAIApiKey: process.env.OPENAI_API_KEY,
    });

    const prompt = PromptTemplate.fromTemplate(`
You are an AI career assistant helping a freelance provider decide whether to pursue an opportunity.
Address the provider directly using "You" and "Your" (never third person).
Output language: {outputLanguage}. Keep names, numbers, and currency codes unchanged.

Your Profile:
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

Generate a concise decision aid in bullet format.
Required structure:
• First bullet: "Fit summary" with your strongest match reason (skill overlap + role/category fit).
• Next 1-2 bullets: concrete strengths (budget alignment, timeline realism, experience relevance, deliverable clarity).
• Final 1 bullet: a practical watch-out/risk (scope ambiguity, timeline risk, stack gap, or budget pressure). If risk is low, say why.

Quality rules:
- Every bullet must reference at least one concrete detail from the inputs (skills, budget, timeline, category, years, etc.).
- No generic phrases like "good opportunity" without evidence.
- Keep each bullet to one sentence, plain text.
- Stay balanced and honest.
- Keep total output to 3-4 bullets.

Format: Use "• " bullets separated by newlines. Return ONLY the bullet lines.
`);

    const chain = RunnableSequence.from([prompt, model]);

    const result = await chain.invoke({
      providerSkills:
        (providerProfile.skills || []).join(", ") || "Not specified",
      providerMajor: providerProfile.major || "Not specified",
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
      outputLanguage: localeLanguageLabel(outputLocale),
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
    const l = String(outputLocale || "en").toLowerCase();
    if (l.startsWith("id")) {
      return `• Peluang ini cocok dengan keahlian Anda di ${topSkills || "bidang keahlian Anda"}\n• Proyek ini berada dalam kategori keahlian Anda\n• Tinjau anggaran dan timeline agar sesuai dengan ketersediaan Anda`;
    }
    if (l.startsWith("ar")) {
      return `• هذه الفرصة تتوافق مع مهاراتك في ${topSkills || "مجال خبرتك"}\n• هذا المشروع يقع ضمن فئة خبرتك\n• راجع الميزانية والجدول الزمني للتأكد من توافقهما مع مدى توفرك`;
    }
    return `• This opportunity matches your skills in ${topSkills || "your expertise area"}\n• The project falls within your category expertise\n• Review the budget and timeline to ensure it aligns with your availability`;
  }
}

/**
 * Get recommended opportunities for a provider
 */
export async function getRecommendedOpportunities(providerId, locale = "en") {
  try {
    const outputLocale = normalizeOutputLocale(locale);
    const cacheKey = `${providerId}:${outputLocale}`;

    // Check cache first; re-validate against DB so closed / already-proposed items disappear immediately
    const cached = getCachedRecommendations(cacheKey);
    if (cached) {
      const filtered = await filterValidRecommendations(
        providerId,
        cached.recommendations,
      );

      if (filtered.length === 0 && cached.recommendations.length > 0) {
        recommendationsCache.delete(cacheKey);
        // Fall through to full recompute below
      } else if (filtered.length > 0) {
        if (filtered.length !== cached.recommendations.length) {
          recommendationsCache.set(cacheKey, {
            recommendations: filtered,
            cachedAt: cached.cachedAt,
          });
        }
        const withDisplay = await enrichRecommendationsWithPreferredCurrency(
          providerId,
          filtered,
        );
        return {
          recommendations: withDisplay,
          cachedAt: cached.cachedAt,
          nextRefreshAt: cached.nextRefreshAt,
          isCached: true,
        };
      }
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

    // Do not compute match scores or AI insights when provider has no skills
    const providerSkills = providerProfile.skills || [];
    if (!Array.isArray(providerSkills) || providerSkills.length === 0) {
      const cachedAt = Date.now();
      const nextRefreshAt = cachedAt + CACHE_DURATION_MS;
      return {
        recommendations: [],
        cachedAt,
        nextRefreshAt,
        isCached: false,
        requiresSkills: true,
      };
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
    const serviceRequestIds = allServiceRequests.map((sr) => sr.id);
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

    const proposedServiceRequestIds = new Set(
      existingProposals.map((p) => p.serviceRequestId),
    );

    // Filter out already proposed requests and calculate match scores
    const scoredRequests = allServiceRequests
      .filter((sr) => !proposedServiceRequestIds.has(sr.id))
      .map((sr) => ({
        serviceRequest: sr,
        matchScore: calculateMatchScore(providerProfile, sr),
      }))
      .sort((a, b) => b.matchScore - a.matchScore) // Sort by match score descending
      .slice(0, 5); // Take top 5

    // Generate AI explanations for each recommendation
    const rawRecommendations = await Promise.all(
      scoredRequests.map(async ({ serviceRequest, matchScore }) => {
        const explanation = await generateAIExplanation(
          providerProfile,
          serviceRequest,
          matchScore,
          outputLocale,
        );

        return {
          id: serviceRequest.id,
          title: serviceRequest.title,
          description: serviceRequest.description,
          category: serviceRequest.category,
          budgetMin: serviceRequest.budgetMin,
          budgetMax: serviceRequest.budgetMax,
          currencyCode: serviceRequest.currencyCode,
          fxSnapshotDate: serviceRequest.fxSnapshotDate,
          fxSnapshotSession: serviceRequest.fxSnapshotSession,
          fxSnapshotQuote: serviceRequest.fxSnapshotQuote,
          fxSnapshotRatesJson: serviceRequest.fxSnapshotRatesJson,
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
      }),
    );

    const recommendations = await enrichRecommendationsWithPreferredCurrency(
      providerId,
      rawRecommendations,
    );

    // Cache the recommendations
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
    console.error("Error fetching recommended opportunities:", error);
    throw new Error("Failed to fetch recommended opportunities");
  }
}
