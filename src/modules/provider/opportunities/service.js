// src/modules/provider/opportunities/service.js
import { prisma } from "./model.js";
import { GetOpportunitiesDto } from "./dto.js";
import { calculateMatchScore } from "../../../shared/recommendation-match-score.js";
import { buildBudgetDisplayData, normalizeCurrencyCode } from "../../fx/service.js";
import { getAiDraftSummaryForLocale, normalizeAiLocale } from "../../../utils/aiDraftLocale.js";
import { createServiceRequestAiDraft } from "../../company/projects/service-request-ai-draft.js";

// Get AiDrafts for service requests (optionally filtered by referenceIds array)
async function getAiDraftsForServiceRequests(referenceIds = null) {
  const where = { type: "SERVICE_REQUEST" };
  if (Array.isArray(referenceIds) && referenceIds.length > 0) {
    where.referenceId = { in: referenceIds };
  }

  const drafts = await prisma.aiDraft.findMany({
    where,
    select: {
      id: true,
      referenceId: true,
      summary: true,
      version: true,
      createdAt: true,
    },
  });

  return drafts;
}

export async function getOpportunities(dto) {
  try {
    const skip = (dto.page - 1) * dto.limit;

    // Build where clause for ServiceRequests
    const where = {
      status: "OPEN", // Only show OPEN ServiceRequests
      NOT: {
        customerId: dto.providerId, // Exclude requests by the same provider
      },
    };

    // Apply filters
    if (dto.category) {
      where.category = dto.category;
    }

    if (dto.skills && dto.skills.length > 0) {
      where.skills = {
        hasSome: dto.skills, // At least one skill matches
      };
    }

    if (dto.search) {
      where.OR = [
        { title: { contains: dto.search, mode: "insensitive" } },
        { description: { contains: dto.search, mode: "insensitive" } },
      ];
    }

    // Get ServiceRequests with proposal count and check if current provider has proposed
    const [serviceRequests, total] = await Promise.all([
      prisma.serviceRequest.findMany({
        where,
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
              isVerified: true, // Include verified status from User table
              customerProfile: {
                select: {
                  companySize: true,
                  industry: true,
                  location: true,
                  website: true,
                  profileImageUrl: true, // Profile image
                  totalSpend: true,
                  projectsPosted: true, // Projects posted count
                },
              },
            },
          },
          milestones: {
            orderBy: {
              order: "asc",
            },
          },
          _count: {
            select: {
              proposals: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: dto.limit,
      }),
      prisma.serviceRequest.count({ where }),
    ]);

    // Check which ServiceRequests the current provider has already proposed to
    const serviceRequestIds = serviceRequests.map((sr) => sr.id);
    const existingProposals = await prisma.proposal.findMany({
      where: {
        providerId: dto.providerId,
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

    // Fetch provider profile for match scoring only when provider has skills
    let providerProfile = null;
    if (dto.providerId && (dto.sort === "best-match" || !dto.sort)) {
      const profile = await prisma.providerProfile.findUnique({
        where: { userId: dto.providerId },
      });
      const hasSkills = Array.isArray(profile?.skills) && profile.skills.length > 0;
      providerProfile = hasSkills ? profile : null;
    }

    // Add hasProposed and matchScore (null when no provider skills); sort by best-match only when scores exist
    const settings = await prisma.settings.findUnique({
      where: { userId: dto.providerId },
      select: { preferredCurrency: true },
    });
    const preferredCurrency = settings?.preferredCurrency || "MYR";

    let opportunities = serviceRequests.map((sr) => {
      const score = providerProfile
        ? calculateMatchScore(providerProfile, sr)
        : null;
      return {
        ...sr,
        hasProposed: proposedServiceRequestIds.has(sr.id),
        matchScore: score,
        ...buildBudgetDisplayData(sr, preferredCurrency),
      };
    });

    if (dto.sort === "best-match" && providerProfile) {
      opportunities = opportunities.sort(
        (a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0),
      );
    }
    // else: already ordered by createdAt desc from findMany

    const totalPages = Math.ceil(total / dto.limit);

    return {
      opportunities,
      pagination: {
        page: dto.page,
        limit: dto.limit,
        total: total, // Use total count from database, not filtered opportunities length
        totalPages,
      },
    };
  } catch (error) {
    console.error("Error fetching opportunities:", error);
    throw new Error("Failed to fetch opportunities");
  }
}

// Fetch AiDrafts for service requests
export async function getAiDraftsService(referenceIds = null, locale = "en") {
  try {
    let drafts = await getAiDraftsForServiceRequests(referenceIds);
    if (Array.isArray(referenceIds) && referenceIds.length > 0) {
      const existingIds = new Set(drafts.map((d) => d.referenceId));
      const missingIds = referenceIds.filter((id) => !existingIds.has(id));
      if (missingIds.length > 0) {
        await Promise.all(
          missingIds.map(async (id) => {
            try {
              await createServiceRequestAiDraft(id);
            } catch {
              // Keep request resilient even if a single draft generation fails.
            }
          }),
        );
        drafts = await getAiDraftsForServiceRequests(referenceIds);
      }
    }
    const normalized = normalizeAiLocale(locale);
    return drafts.map((draft) => ({
      ...draft,
      summary: getAiDraftSummaryForLocale(draft.summary, normalized),
    }));
  } catch (error) {
    console.error("Error fetching AiDrafts:", error);
    throw new Error("Failed to fetch AI drafts");
  }
}

export async function getOpportunityById(opportunityId, providerId) {
  try {
    const serviceRequest = await prisma.serviceRequest.findFirst({
      where: {
        id: opportunityId,
        status: "OPEN",
        NOT: {
          customerId: providerId, // Exclude requests by the same provider
        },
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            isVerified: true, // Include verified status from User table
            customerProfile: {
              select: {
                companySize: true,
                industry: true,
                location: true,
                website: true,
                description: true,
                profileImageUrl: true, // Profile image
                totalSpend: true,
                projectsPosted: true, // Projects posted count
              },
            },
          },
        },
        milestones: {
          orderBy: {
            order: "asc",
          },
        },
        _count: {
          select: {
            proposals: true,
          },
        },
      },
    });

    if (!serviceRequest) {
      const relatedRequest = await prisma.serviceRequest.findUnique({
        where: { id: opportunityId },
        select: {
          id: true,
          status: true,
          customerId: true,
          projectId: true,
          project: {
            select: {
              id: true,
              providerId: true,
            },
          },
        },
      });

      // Common happy-path after acceptance:
      // the opportunity is no longer OPEN and now points to a Project.
      if (
        relatedRequest?.project?.id &&
        relatedRequest.project.providerId === providerId
      ) {
        const movedError = new Error("Opportunity moved to project");
        movedError.code = "OPPORTUNITY_MOVED_TO_PROJECT";
        movedError.statusCode = 409;
        movedError.projectId = relatedRequest.project.id;
        throw movedError;
      }

      // Filled, closed, or matched with another provider — same UX for everyone else.
      if (relatedRequest?.status && relatedRequest.status !== "OPEN") {
        const closedError = new Error(
          "This opportunity is no longer open for proposals."
        );
        closedError.code = "OPPORTUNITY_NO_LONGER_AVAILABLE";
        closedError.statusCode = 404;
        throw closedError;
      }

      // Request exists and is still OPEN but was not returned (e.g. excluded self-post).
      if (relatedRequest) {
        const forbiddenError = new Error(
          "You do not have permission to view this opportunity"
        );
        forbiddenError.code = "OPPORTUNITY_ACCESS_DENIED";
        forbiddenError.statusCode = 403;
        throw forbiddenError;
      }

      const notFoundError = new Error("Opportunity not found");
      notFoundError.code = "OPPORTUNITY_NOT_FOUND";
      notFoundError.statusCode = 404;
      throw notFoundError;
    }

    // Check if provider has already proposed
    const existingProposal = await prisma.proposal.findFirst({
      where: {
        providerId: providerId,
        serviceRequestId: opportunityId,
      },
    });

    const settings = await prisma.settings.findUnique({
      where: { userId: providerId },
      select: { preferredCurrency: true },
    });
    const preferredCurrency = settings?.preferredCurrency || "MYR";

    // projectsPosted is already in customer.customerProfile from the query above (from database)
    return {
      ...serviceRequest,
      hasProposed: !!existingProposal,
      preferredCurrency: normalizeCurrencyCode(preferredCurrency) || "MYR",
      ...buildBudgetDisplayData(serviceRequest, preferredCurrency),
    };
  } catch (error) {
    if (error?.statusCode || error?.code) {
      throw error;
    }
    console.error("Error fetching opportunity:", error);
    const failedError = new Error("Failed to fetch opportunity");
    failedError.code = "OPPORTUNITY_FETCH_FAILED";
    failedError.statusCode = 500;
    throw failedError;
  }
}

function cleanPlainText(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/(\*\*|__|\*|_)(.*?)\1/g, "$2")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function generateOpportunityProposalAiDraft(opportunityId, providerId, payload = {}) {
  const serviceRequest = await prisma.serviceRequest.findFirst({
    where: {
      id: opportunityId,
      NOT: { customerId: providerId },
    },
    include: {
      project: {
        select: {
          id: true,
          providerId: true,
        },
      },
      customer: {
        select: {
          name: true,
          customerProfile: {
            select: {
              industry: true,
            },
          },
        },
      },
    },
  });

  if (!serviceRequest) {
    throw new Error("Opportunity not found");
  }

  // Allow AI drafting for:
  // 1) OPEN opportunities, OR
  // 2) already matched requests linked to this provider's project
  if (
    serviceRequest.status !== "OPEN" &&
    serviceRequest.project?.providerId !== providerId
  ) {
    throw new Error("Opportunity not found");
  }

  const providerProfile = await prisma.providerProfile.findUnique({
    where: { userId: providerId },
    include: {
      user: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });

  if (!providerProfile) {
    throw new Error("Provider profile not found");
  }

  const bidAmount = Number(payload.bidAmount || 0);
  const timelineAmount = Number(payload.timelineAmount || 0);
  const timelineUnit = String(payload.timelineUnit || "").trim();
  const processPreference = cleanPlainText(payload.processPreference || "");

  const prompt = PromptTemplate.fromTemplate(`
You are an expert proposal-writing assistant for a freelance marketplace.
Write natural, professional, client-facing content in plain text only.

Provider context:
- Name: {providerName}
- Major/Role: {providerMajor}
- Bio: {providerBio}
- Skills: {providerSkills}
- Years Experience: {yearsExperience}
- Work Preference: {workPreference}
- Availability: {availability}

Project context:
- Title: {projectTitle}
- Description: {projectDescription}
- Category: {projectCategory}
- Requirements: {requirements}
- Deliverables: {deliverables}
- Skills Required: {projectSkills}
- Timeline: {projectTimeline}
- Budget: {budgetMin} - {budgetMax}
- Client industry: {clientIndustry}

Proposal context:
- Bid Amount: {bidAmount}
- Timeline Choice: {timelineAmount} {timelineUnit}
- Provider process preference: {processPreference}

Return ONLY valid JSON with this exact shape:
{{
  "coverLetter": "string",
  "milestones": [
    {{ "title": "string", "description": "string" }}
  ],
  "explanation": ["string", "string"]
}}

Rules:
- Plain text only, no markdown, no HTML.
- Cover letter must sound like a real provider speaking to the client.
- Milestone descriptions must also sound human and professional.
- Generate 3-6 milestones.
- Keep explanations concise and practical.
`);

  const model = new ChatOpenAI({
    modelName: "gpt-4o",
    temperature: 0.35,
    openAIApiKey: process.env.OPENAI_API_KEY,
  });

  const chain = RunnableSequence.from([prompt, model]);
  const result = await chain.invoke({
    providerName: providerProfile.user?.name || "Provider",
    providerMajor: providerProfile.major || "",
    providerBio: providerProfile.bio || "",
    providerSkills: (providerProfile.skills || []).slice(0, 10).join(", "),
    yearsExperience: String(providerProfile.yearsExperience || ""),
    workPreference: providerProfile.workPreference || "",
    availability: providerProfile.availability || "",
    projectTitle: serviceRequest.title || "",
    projectDescription: serviceRequest.description || "",
    projectCategory: serviceRequest.category || "",
    requirements: Array.isArray(serviceRequest.requirements)
      ? serviceRequest.requirements.join(", ")
      : String(serviceRequest.requirements || ""),
    deliverables: Array.isArray(serviceRequest.deliverables)
      ? serviceRequest.deliverables.join(", ")
      : String(serviceRequest.deliverables || ""),
    projectSkills: (serviceRequest.skills || []).join(", "),
    projectTimeline: serviceRequest.timeline || "",
    budgetMin: String(serviceRequest.budgetMin || 0),
    budgetMax: String(serviceRequest.budgetMax || 0),
    clientIndustry: serviceRequest.customer?.customerProfile?.industry || "",
    bidAmount: String(Number.isFinite(bidAmount) ? bidAmount : 0),
    timelineAmount: String(Number.isFinite(timelineAmount) ? timelineAmount : 0),
    timelineUnit,
    processPreference,
  });

  const raw = String(result?.content || "").trim();
  const jsonCandidate = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "");
  let parsed;
  try {
    parsed = JSON.parse(jsonCandidate);
  } catch {
    throw new Error("AI draft response was invalid");
  }

  const milestones = Array.isArray(parsed?.milestones)
    ? parsed.milestones
        .map((m) => ({
          title: cleanPlainText(m?.title),
          description: cleanPlainText(m?.description),
        }))
        .filter((m) => m.title && m.description)
        .slice(0, 6)
    : [];

  const explanation = Array.isArray(parsed?.explanation)
    ? parsed.explanation.map((item) => cleanPlainText(item)).filter(Boolean).slice(0, 4)
    : [];

  return {
    coverLetter: cleanPlainText(parsed?.coverLetter || ""),
    milestones,
    explanation,
  };
}
