// src/modules/company/project-requests/index.js
import express from "express";
import {
  getProjectRequestsController,
  getProjectRequestController,
  acceptProposalController,
  rejectProposalController,
  getProposalStatsController,
  exportRequestsController,
} from "./controller.js";
import { authenticateToken } from "../../../middlewares/auth.js";

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Routes
router.get("/", getProjectRequestsController);
router.get("/stats", getProposalStatsController);
router.get("/export", exportRequestsController);
router.get("/:id", getProjectRequestController);
router.post("/:id/accept", acceptProposalController);
router.post("/:id/reject", rejectProposalController);

export default router;