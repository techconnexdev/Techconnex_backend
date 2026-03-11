// src/modules/company/find-providers/index.js
import express from "express";
import { authenticateToken, optionalAuthenticateToken } from "../../../middlewares/auth.js";
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

// Optional auth: allow guests to browse providers; logged-in users get req.user (e.g. for saved status)
router.use(optionalAuthenticateToken);

// Provider search and listing (public)
router.get("/", findProviders);
router.get("/filters", getFilters);

// Auth required: recommended and ai-drafts are user-specific
router.get("/recommended", authenticateToken, getRecommendedProvidersController);
router.get("/ai-drafts", authenticateToken, getAiDraftsController);

// Auth required: saved providers for user (must come before /:id routes)
router.get("/users/:userId/saved-providers", authenticateToken, getSavedProviders);

// Individual provider endpoints (public read; specific routes must come before generic /:id)
router.get("/:id/full", getProviderFullDetails);
router.get("/:id/portfolio", getProviderPortfolioController);
router.get("/:id/completed-projects", getProviderCompletedProjectsController);
router.get("/:id/reviews", getProviderReviews);
router.get("/:id/stats", getProviderStats);

// Auth required: save/unsave provider
router.post("/:id/save", authenticateToken, saveProvider);
router.delete("/:id/save", authenticateToken, unsaveProvider);

// Generic provider detail (public)
router.get("/:id", getProvider);

export default router;
