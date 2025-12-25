import { dashboardModel } from "./model.js";

export const dashboardService = {
  async getDashboardStats() {
    try {
      const stats = await dashboardModel.getDashboardStats();
      return stats;
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      throw new Error("Failed to fetch dashboard statistics");
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

