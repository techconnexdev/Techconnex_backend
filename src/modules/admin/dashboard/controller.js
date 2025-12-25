import { dashboardService } from "./service.js";

export const dashboardController = {
  async getDashboardStats(req, res) {
    try {
      const stats = await dashboardService.getDashboardStats();
      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },

  async getRecentActivity(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 10;
      const activities = await dashboardService.getRecentActivity(limit);
      res.json({
        success: true,
        data: activities,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },

  async getPendingVerifications(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 5;
      const verifications = await dashboardService.getPendingVerifications(limit);
      res.json({
        success: true,
        data: verifications,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },

  async getTopProviders(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 5;
      const providers = await dashboardService.getTopProviders(limit);
      res.json({
        success: true,
        data: providers,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },
};

