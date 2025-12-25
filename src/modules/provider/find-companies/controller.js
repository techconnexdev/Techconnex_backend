// src/modules/provider/find-companies/controller.js
import {
  searchCompanies,
  getCompanyDetails,
  getCompanyReviewsList,
  saveCompanyService,
  unsaveCompanyService,
  getSavedCompaniesService,
  getCompanyStatistics,
  getFilterOptions,
  getCompanyOpportunities,
  getAiDraftsService,
} from "./service.js";
import { FindCompaniesDto, SaveCompanyDto, CompanyDetailDto } from "./dto.js";

// GET /api/companies - Search and filter companies
export async function findCompanies(req, res) {
  try {
    const dto = new FindCompaniesDto(req.query);
    dto.validate();

    const result = await searchCompanies(dto);
    
    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Error in findCompanies:", error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

// GET /api/companies/:id - Get company details
export async function getCompany(req, res) {
  try {
    const dto = new CompanyDetailDto({
      companyId: req.params.id,
      userId: req.query.userId,
    });
    dto.validate();

    const company = await getCompanyDetails(dto.companyId, dto.userId);
    
    res.json({
      success: true,
      company,
    });
  } catch (error) {
    console.error("Error in getCompany:", error);
    res.status(404).json({
      success: false,
      message: error.message,
    });
  }
}

// GET /api/companies/:id/reviews - Get company reviews
export async function getCompanyReviews(req, res) {
  try {
    const companyId = req.params.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "Company ID is required",
      });
    }

    const result = await getCompanyReviewsList(companyId, page, limit);
    
    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Error in getCompanyReviews:", error);
    res.status(404).json({
      success: false,
      message: error.message,
    });
  }
}

// GET /api/companies/:id/stats - Get company statistics
export async function getCompanyStats(req, res) {
  try {
    const companyId = req.params.id;
    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "Company ID is required",
      });
    }

    const stats = await getCompanyStatistics(companyId);
    
    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error("Error in getCompanyStats:", error);
    res.status(404).json({
      success: false,
      message: error.message,
    });
  }
}

// POST /api/companies/:id/save - Save company
export async function saveCompany(req, res) {
  try {
    const dto = new SaveCompanyDto({
      userId: req.query.userId,
      companyId: req.params.id,
    });
    dto.validate();

    const result = await saveCompanyService(dto.userId, dto.companyId);
    
    res.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    console.error("Error in saveCompany:", error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

// DELETE /api/companies/:id/save - Unsave company
export async function unsaveCompany(req, res) {
  try {
    const dto = new SaveCompanyDto({
      userId: req.query.userId,
      companyId: req.params.id,
    });
    dto.validate();

    const result = await unsaveCompanyService(dto.userId, dto.companyId);
    
    res.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    console.error("Error in unsaveCompany:", error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

// GET /api/users/:userId/saved-companies - Get saved companies
export async function getSavedCompanies(req, res) {
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

    const result = await getSavedCompaniesService(userId, page, limit);
    
    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Error in getSavedCompanies:", error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

// GET /api/companies/filters - Get filter options
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

// GET /api/companies/:id/opportunities - Get company opportunities
export async function getCompanyOpportunitiesController(req, res) {
  try {
    const companyId = req.params.id;
    const providerId = req.user?.userId || null; // Get provider ID from authenticated user

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "Company ID is required",
      });
    }

    const opportunities = await getCompanyOpportunities(companyId, providerId);
    
    res.json({
      success: true,
      data: opportunities,
    });
  } catch (error) {
    console.error("Error in getCompanyOpportunities:", error);
    res.status(404).json({
      success: false,
      message: error.message,
    });
  }
}

// Combined endpoint for company details with reviews
export async function getCompanyFullDetails(req, res) {
  try {
    const dto = new CompanyDetailDto({
      companyId: req.params.id,
      userId: req.query.userId,
    });
    dto.validate();

    // Get all data in parallel
    const [company, reviewsResult] = await Promise.all([
      getCompanyDetails(dto.companyId, dto.userId),
      getCompanyReviewsList(dto.companyId, 1, 5), // Get first 5 reviews
    ]);
    
    res.json({
      success: true,
      company,
      reviews: reviewsResult.reviews,
    });
  } catch (error) {
    console.error("Error in getCompanyFullDetails:", error);
    res.status(404).json({
      success: false,
      message: error.message,
    });
  }
}

// GET /api/companies/ai-drafts - get ai draft summaries for companies
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

