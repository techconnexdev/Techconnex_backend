import { dashboardModel } from "./model.js";
import { paymentService } from "../payment/service.js";

export const dashboardService = {
  async getDashboardStats() {
    try {
      // Get basic stats from dashboard model
      const basicStats = await dashboardModel.getDashboardStats();
      
      // Get revenue stats from payment service
      const revenueStats = await paymentService.getRevenueStats();
      
      // Merge revenue stats into dashboard stats
      const result = {
        ...basicStats,
        totalRevenue: revenueStats?.totalRevenue ?? 0,
        platformGrowth: revenueStats?.growthRate ?? 0,
      };
      
      return result;
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
      });
      // If revenue stats fail, return basic stats with zero revenue
      const basicStats = await dashboardModel.getDashboardStats();
      return {
        ...basicStats,
        totalRevenue: 0,
        platformGrowth: 0,
      };
    }
  },

  async getRecentActivity(limit = 10) {
    try {
      const activities = await dashboardModel.getRecentActivity(limit);
      return activities;
    } catch (error) {
      console.error("Error fetching recent activity:", error);
      throw new Error("Failed to fetch recent activity");
    }
  },

  async getPendingVerifications(limit = 5) {
    try {
      const verifications = await dashboardModel.getPendingVerifications(limit);
      return verifications;
    } catch (error) {
      console.error("Error fetching pending verifications:", error);
      throw new Error("Failed to fetch pending verifications");
    }
  },

  async getTopProviders(limit = 5) {
    try {
      const providers = await dashboardModel.getTopProviders(limit);
      return providers;
    } catch (error) {
      console.error("Error fetching top providers:", error);
      throw new Error("Failed to fetch top providers");
    }
  },
};

