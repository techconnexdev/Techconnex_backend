import express from "express";
import { reportsController } from "./controller.js";
import { authenticateToken, requireAdmin } from "../../../middlewares/auth.js";

const router = express.Router();

// All routes require admin authentication
router.use(authenticateToken, requireAdmin);

// Get overview stats
router.get("/overview", reportsController.getOverviewStats);

// Get monthly performance data
router.get("/monthly", reportsController.getMonthlyData);

// Get category breakdown
router.get("/categories", reportsController.getCategoryBreakdown);

// Get top providers
router.get("/top-providers", reportsController.getTopProviders);

// Get top customers
router.get("/top-customers", reportsController.getTopCustomers);

// Get all reports data in one call
router.get("/", reportsController.getAllReportsData);

// Get category details
router.get("/category/:category", reportsController.getCategoryDetails);

// Export report
router.get("/export", reportsController.exportReport);

export default router;

