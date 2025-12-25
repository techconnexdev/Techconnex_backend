// src/modules/provider/find-companies/index.js
import express from "express";
import { authenticateToken } from "../../../middlewares/auth.js";
import {
  findCompanies,
  getCompany,
  getCompanyReviews,
  getCompanyStats,
  saveCompany,
  unsaveCompany,
  getSavedCompanies,
  getFilters,
  getCompanyFullDetails,
  getCompanyOpportunitiesController,
  getAiDraftsController,
} from "./controller.js";

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Company search and listing
router.get("/", findCompanies);
router.get("/filters", getFilters);
router.get("/ai-drafts", getAiDraftsController);

// Individual company endpoints
router.get("/:id", getCompany);
router.get("/:id/full", getCompanyFullDetails); // Combined endpoint for frontend
router.get("/:id/reviews", getCompanyReviews);
router.get("/:id/stats", getCompanyStats);
router.get("/:id/opportunities", getCompanyOpportunitiesController);

// Save/unsave company
router.post("/:id/save", saveCompany);
router.delete("/:id/save", unsaveCompany);

// Saved companies for user
router.get("/users/:userId/saved-companies", getSavedCompanies);

export default router;

