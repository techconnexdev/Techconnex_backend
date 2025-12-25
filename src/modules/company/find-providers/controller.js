// src/modules/company/find-providers/controller.js
import {
  searchProviders,
  getProviderDetails,
  getProviderPortfolio,
  getProviderCompletedProjects,
  getProviderReviewsList,
  saveProviderService,
  unsaveProviderService,
  getSavedProvidersService,
  getProviderStatistics,
  getFilterOptions,
  getAiDraftsService,
} from "./service.js";
import { getRecommendedProviders } from "./recommended-service.js";
import { FindProvidersDto, SaveProviderDto, ProviderDetailDto } from "./dto.js";

// GET /api/providers - Search and filter providers
export async function findProviders(req, res) {
  try {
    const dto = new FindProvidersDto(req.query);
    dto.validate();

    const result = await searchProviders(dto);

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Error in findProviders:", error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

// GET /api/providers/:id - Get provider details (with portfolio and reviews)
export async function getProvider(req, res) {
  try {
    const dto = new ProviderDetailDto({
      providerId: req.params.id,
      userId: req.query.userId,
    });
    dto.validate();

    // Get all data in parallel (provider, portfolio, reviews)
    const [provider, portfolio, reviewsResult] = await Promise.all([
      getProviderDetails(dto.providerId, dto.userId),
      getProviderPortfolio(dto.providerId).catch(() => []), // Return empty array if portfolio fails
      getProviderReviewsList(dto.providerId, 1, 5).catch(() => ({
        reviews: [],
      })), // Get first 5 reviews, return empty if fails
    ]);

    res.json({
      success: true,
      provider,
      portfolio: portfolio || [],
      reviews: reviewsResult?.reviews || [],
    });
  } catch (error) {
    console.error("Error in getProvider:", error);
    res.status(404).json({
      success: false,
      message: error.message,
    });
  }
}

// GET /api/providers/:id/portfolio - Get provider portfolio
export async function getProviderPortfolioController(req, res) {
  try {
    const providerId = req.params.id;
    if (!providerId) {
      return res.status(400).json({
        success: false,
        message: "Provider ID is required",
      });
    }

    const portfolio = await getProviderPortfolio(providerId);

    res.json({
      success: true,
      portfolio,
    });
  } catch (error) {
    console.error("Error in getProviderPortfolio:", error);
    res.status(404).json({
      success: false,
      message: error.message,
    });
  }
}

// GET /api/providers/:id/reviews - Get provider reviews
export async function getProviderReviews(req, res) {
  try {
    const providerId = req.params.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    if (!providerId) {
      return res.status(400).json({
        success: false,
        message: "Provider ID is required",
      });
    }

    const result = await getProviderReviewsList(providerId, page, limit);

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Error in getProviderReviews:", error);
    res.status(404).json({
      success: false,
      message: error.message,
    });
  }
}

// GET /api/providers/:id/stats - Get provider statistics
export async function getProviderStats(req, res) {
  try {
    const providerId = req.params.id;
    if (!providerId) {
      return res.status(400).json({
        success: false,
        message: "Provider ID is required",
      });
    }

    const stats = await getProviderStatistics(providerId);

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error("Error in getProviderStats:", error);
    res.status(404).json({
      success: false,
      message: error.message,
    });
  }
}

// POST /api/providers/:id/save - Save provider
export async function saveProvider(req, res) {
  try {
    const dto = new SaveProviderDto({
      userId: req.query.userId,
      providerId: req.params.id,
    });
    dto.validate();

    const result = await saveProviderService(dto.userId, dto.providerId);

    res.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    console.error("Error in saveProvider:", error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

// DELETE /api/providers/:id/save - Unsave provider
export async function unsaveProvider(req, res) {
  try {
    const dto = new SaveProviderDto({
      userId: req.query.userId,
      providerId: req.params.id,
    });
    dto.validate();

    const result = await unsaveProviderService(dto.userId, dto.providerId);

    res.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    console.error("Error in unsaveProvider:", error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

// GET /api/users/:userId/saved-providers - Get saved providers
export async function getSavedProviders(req, res) {
  try {
    const userId = req.params.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    const result = await getSavedProvidersService(userId, page, limit);

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Error in getSavedProviders:", error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

// GET /api/providers/filters - Get filter options
export async function getFilters(req, res) {
  try {
    const options = await getFilterOptions();

    res.json({
      success: true,
      ...options,
    });
  } catch (error) {
    console.error("Error in getFilters:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

// GET /api/providers/ai-drafts - get ai draft summaries for providers
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

// GET /api/providers/:id/completed-projects - Get completed projects for provider
export async function getProviderCompletedProjectsController(req, res) {
  try {
    const providerId = req.params.id;
    if (!providerId) {
      return res.status(400).json({
        success: false,
        message: "Provider ID is required",
      });
    }

    const completedProjects = await getProviderCompletedProjects(providerId);

    res.json({
      success: true,
      data: completedProjects,
    });
  } catch (error) {
    console.error("Error in getProviderCompletedProjects:", error);
    res.status(404).json({
      success: false,
      message: error.message,
    });
  }
}

// Combined endpoint for provider details with portfolio and reviews
export async function getProviderFullDetails(req, res) {
  try {
    const dto = new ProviderDetailDto({
      providerId: req.params.id,
      userId: req.query.userId,
    });
    dto.validate();

    // Get all data in parallel
    const [provider, portfolio, reviewsResult] = await Promise.all([
      getProviderDetails(dto.providerId, dto.userId),
      getProviderPortfolio(dto.providerId),
      getProviderReviewsList(dto.providerId, 1, 5), // Get first 5 reviews
    ]);

    res.json({
      success: true,
      provider,
      portfolio,
      reviews: reviewsResult.reviews,
    });
  } catch (error) {
    console.error("Error in getProviderFullDetails:", error);
    res.status(404).json({
      success: false,
      message: error.message,
    });
  }
}

// GET /api/providers/recommended - Get recommended providers for company
export async function getRecommendedProvidersController(req, res) {
  try {
    // Get user ID from JWT payload (could be userId or id)
    const customerId = req.user?.userId || req.user?.id;

    if (!customerId) {
      return res.status(401).json({
        success: false,
        message: "User ID not found in token",
      });
    }

    const result = await getRecommendedProviders(customerId);

    res.json({
      success: true,
      recommendations: result.recommendations,
      cachedAt: result.cachedAt,
      nextRefreshAt: result.nextRefreshAt,
      isCached: result.isCached,
    });
  } catch (error) {
    console.error("Error in getRecommendedProvidersController:", error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}
