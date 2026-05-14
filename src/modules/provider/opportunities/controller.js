// src/modules/provider/opportunities/controller.js
import { FRIENDLY_500_MESSAGE } from "../../../utils/errors.js";
import {
  getOpportunities,
  getOpportunityById,
  getAiDraftsService,
  generateOpportunityProposalAiDraft,
} from "./service.js";
import { getRecommendedOpportunities } from "./recommended-service.js";
import { GetOpportunitiesDto } from "./dto.js";
import { prisma } from "./model.js";

function sanitizeLocale(locale) {
  const code = String(locale || "en").trim().toLowerCase();
  if (code.startsWith("id")) return "id";
  if (code.startsWith("ar")) return "ar";
  return "en";
}

// GET /api/provider/opportunities - Get all opportunities for providers
export async function getOpportunitiesController(req, res) {
  try {
    // Get user ID from JWT payload (could be userId or id)
    const providerId = req.user?.userId || req.user?.id;
    
    if (!providerId) {
      return res.status(401).json({
        success: false,
        message: "User ID not found in token",
      });
    }

    const dto = new GetOpportunitiesDto({
      providerId,
      ...req.query,
    });
    dto.validate();

    const result = await getOpportunities(dto);

    res.json({
      success: true,
      opportunities: result.opportunities,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("Error in getOpportunitiesController:", error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

// GET /api/provider/opportunities/:id - Get a specific opportunity
export async function getOpportunityController(req, res) {
  try {
    const opportunityId = req.params.id;
    // Get user ID from JWT payload (could be userId or id)
    const providerId = req.user?.userId || req.user?.id;

    if (!opportunityId) {
      return res.status(400).json({
        success: false,
        message: "Opportunity ID is required",
      });
    }

    if (!providerId) {
      return res.status(401).json({
        success: false,
        message: "User ID not found in token",
      });
    }

    const opportunity = await getOpportunityById(opportunityId, providerId);

    res.json({
      success: true,
      opportunity,
    });
  } catch (error) {
    console.error("Error in getOpportunityController:", error);
    const statusCode = Number(error?.statusCode) || 500;
    res.status(statusCode).json({
      success: false,
      message: error?.message || "Failed to fetch opportunity",
      ...(error?.code ? { code: error.code } : {}),
      ...(error?.projectId ? { projectId: error.projectId } : {}),
    });
  }
}

// GET /api/provider/opportunities/recommended - Get recommended opportunities for provider
export async function getRecommendedOpportunitiesController(req, res) {
  try {
    // Get user ID from JWT payload (could be userId or id)
    const providerId = req.user?.userId || req.user?.id;
    
    if (!providerId) {
      return res.status(401).json({
        success: false,
        message: "User ID not found in token",
      });
    }

    const queryLocale =
      typeof req.query?.lang === "string" && req.query.lang.trim()
        ? req.query.lang.trim().toLowerCase()
        : "";
    const settings = await prisma.settings.findUnique({
      where: { userId: providerId },
      select: { locale: true },
    });
    const locale = sanitizeLocale(queryLocale || settings?.locale || "en");
    const result = await getRecommendedOpportunities(providerId, locale);

    res.json({
      success: true,
      recommendations: result.recommendations,
      cachedAt: result.cachedAt,
      nextRefreshAt: result.nextRefreshAt,
      isCached: result.isCached,
      ...(result.requiresSkills && { requiresSkills: true }),
    });
  } catch (error) {
    console.error("Error in getRecommendedOpportunitiesController:", error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

// GET /api/provider/opportunities/ai-drafts - get ai draft summaries for service requests
export async function getAiDraftsController(req, res) {
  try {
    const referenceIdsParam = req.query.referenceIds;
    let referenceIds = null;
    if (referenceIdsParam) {
      referenceIds = referenceIdsParam
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }

    const queryLocale =
      typeof req.query?.lang === "string" && req.query.lang.trim()
        ? req.query.lang.trim().toLowerCase()
        : "";
    const requesterId = req.user?.userId || req.user?.id;
    const settings = requesterId
      ? await prisma.settings.findUnique({
          where: { userId: requesterId },
          select: { locale: true },
        })
      : null;
    const locale = sanitizeLocale(queryLocale || settings?.locale || "en");

    const drafts = await getAiDraftsService(referenceIds, locale);

    res.json({ success: true, drafts });
  } catch (error) {
    console.error("Error in getAiDraftsController:", error);
    res.status(500).json({ success: false, message: FRIENDLY_500_MESSAGE });
  }
}

// POST /api/provider/opportunities/:id/ai-draft
export async function generateOpportunityProposalAiDraftController(req, res) {
  try {
    const opportunityId = req.params.id;
    const providerId = req.user?.userId || req.user?.id;

    if (!opportunityId) {
      return res.status(400).json({
        success: false,
        message: "Opportunity ID is required",
      });
    }

    if (!providerId) {
      return res.status(401).json({
        success: false,
        message: "User ID not found in token",
      });
    }

    const draft = await generateOpportunityProposalAiDraft(
      opportunityId,
      providerId,
      req.body || {},
    );

    return res.json({
      success: true,
      draft,
    });
  } catch (error) {
    console.error("Error in generateOpportunityProposalAiDraftController:", error);
    return res.status(400).json({
      success: false,
      message: error?.message || "Failed to generate AI draft",
    });
  }
}
