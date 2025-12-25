// src/modules/provider/opportunities/controller.js
import {
  getOpportunities,
  getOpportunityById,
  getAiDraftsService,
} from "./service.js";
import { getRecommendedOpportunities } from "./recommended-service.js";
import { GetOpportunitiesDto } from "./dto.js";

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
    res.status(404).json({
      success: false,
      message: error.message,
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

    const result = await getRecommendedOpportunities(providerId);

    res.json({
      success: true,
      recommendations: result.recommendations,
      cachedAt: result.cachedAt,
      nextRefreshAt: result.nextRefreshAt,
      isCached: result.isCached,
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

    const drafts = await getAiDraftsService(referenceIds);

    res.json({ success: true, drafts });
  } catch (error) {
    console.error("Error in getAiDraftsController:", error);
    res.status(500).json({ success: false, message: error.message });
  }
}
