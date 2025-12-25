import express from "express";
import { dashboardController } from "./controller.js";
import { authenticateToken, requireAdmin } from "../../../middlewares/auth.js";

const router = express.Router();

// All routes require admin authentication
router.use(authenticateToken, requireAdmin);

// Get dashboard stats
router.get("/stats", dashboardController.getDashboardStats);

// Get recent activity
router.get("/activity", dashboardController.getRecentActivity);

// Get pending verifications
router.get("/verifications", dashboardController.getPendingVerifications);

// Get top providers
router.get("/top-providers", dashboardController.getTopProviders);

export default router;

