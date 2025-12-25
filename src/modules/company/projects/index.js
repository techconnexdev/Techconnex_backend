// src/modules/company/projects/index.js
import express from "express";
import {
  createProjectController,
  getProjectsController,
  getProjectController,
  updateProjectStatusController,
  getServiceRequestMilestonesController,
  updateServiceRequestMilestonesController,
  updateProjectDetailsController,
  approveIndividualMilestoneController,
  requestMilestoneChangesController,
  payMilestoneController,
  getCompanyProjectStatsController,
  exportProjectsController,
  analyzeProjectDocumentController,
} from "./controller.js";
import { authenticateToken } from "../../../middlewares/auth.js";

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Routes
// Document analysis now uses R2 - frontend uploads to R2 first, then sends key
router.post("/analyze-document", analyzeProjectDocumentController);
router.post("/", createProjectController);
router.get("/", getProjectsController);
router.get("/stats", getCompanyProjectStatsController);
router.get("/export", exportProjectsController);
router.get("/:id", getProjectController);
router.put("/:id/status", updateProjectStatusController);
router.put("/:id", updateProjectDetailsController); // NEW

// ServiceRequest milestone management routes
router.get("/:id/milestones", getServiceRequestMilestonesController);
router.post("/:id/milestones", updateServiceRequestMilestonesController);

// Individual milestone approval route
router.post("/milestones/:id/approve", approveIndividualMilestoneController);

// Individual milestone request changes route
router.post("/milestones/:id/request-changes", requestMilestoneChangesController);

// Individual milestone payment route
router.post("/milestones/:id/pay", payMilestoneController);

export default router;