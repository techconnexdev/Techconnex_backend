// src/modules/provider/projects/index.js
import express from "express";
import {
  getProjectsController,
  getProjectController,
  updateProjectStatusController,
  updateMilestoneStatusController,
  getProjectStatsController,
  getPerformanceMetricsController,
  exportProjectsController,
  generateProjectMilestonesAiDraftController,
} from "./controller.js";
import { authenticateToken } from "../../../middlewares/auth.js";

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Routes
router.get("/", getProjectsController);
router.get("/stats", getProjectStatsController);
router.get("/performance", getPerformanceMetricsController);
router.get("/export", exportProjectsController);
router.get("/:id", getProjectController);
router.put("/:id/status", updateProjectStatusController);
router.post("/:id/milestones/ai-draft", generateProjectMilestonesAiDraftController);

// Milestone management routes
router.put("/milestones/:id/status", updateMilestoneStatusController);

export default router;
