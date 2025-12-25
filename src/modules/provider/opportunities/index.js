// src/modules/provider/opportunities/index.js
import express from "express";
import {
  getOpportunitiesController,
  getOpportunityController,
  getRecommendedOpportunitiesController,
  getAiDraftsController,
} from "./controller.js";
import { authenticateToken } from "../../../middlewares/auth.js";

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Routes
router.get("/recommended", getRecommendedOpportunitiesController);
router.get("/ai-drafts", getAiDraftsController);
router.get("/", getOpportunitiesController);
router.get("/:id", getOpportunityController);

export default router;
