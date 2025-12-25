// src/modules/company/find-providers/index.js
import express from "express";
import { authenticateToken } from "../../../middlewares/auth.js";
import {
  findProviders,
  getProvider,
  getProviderPortfolioController,
  getProviderCompletedProjectsController,
  getProviderReviews,
  getProviderStats,
  saveProvider,
  unsaveProvider,
  getSavedProviders,
  getFilters,
  getProviderFullDetails,
  getRecommendedProvidersController,
  getAiDraftsController,
} from "./controller.js";

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Provider search and listing
router.get("/recommended", getRecommendedProvidersController);
router.get("/", findProviders);
router.get("/filters", getFilters);
router.get("/ai-drafts", getAiDraftsController);

// Saved providers for user (must come before /:id routes)
router.get("/users/:userId/saved-providers", getSavedProviders);

// Individual provider endpoints (specific routes must come before generic /:id)
router.get("/:id/full", getProviderFullDetails); // Combined endpoint for frontend
router.get("/:id/portfolio", getProviderPortfolioController);
router.get("/:id/completed-projects", getProviderCompletedProjectsController);
router.get("/:id/reviews", getProviderReviews);
router.get("/:id/stats", getProviderStats);

// Save/unsave provider
router.post("/:id/save", saveProvider);
router.delete("/:id/save", unsaveProvider);

// Generic provider endpoint (must be last)
router.get("/:id", getProvider);

export default router;
