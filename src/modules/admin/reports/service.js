import { reportsModel } from "./model.js";

export const reportsService = {
  async getOverviewStats(dateRange, customStartDate, customEndDate) {
    try {
      const stats = await reportsModel.getOverviewStats(dateRange, customStartDate, customEndDate);
      return stats;
    } catch (error) {
      throw new Error(`Failed to get overview stats: ${error.message}`);
    }
  },

  async getMonthlyData(dateRange, customStartDate, customEndDate) {
    try {
      const data = await reportsModel.getMonthlyData(dateRange, customStartDate, customEndDate);
      return data;
    } catch (error) {
      throw new Error(`Failed to get monthly data: ${error.message}`);
    }
  },

  async getCategoryBreakdown(dateRange, customStartDate, customEndDate) {
    try {
      const breakdown = await reportsModel.getCategoryBreakdown(dateRange, customStartDate, customEndDate);
      return breakdown;
    } catch (error) {
      throw new Error(`Failed to get category breakdown: ${error.message}`);
    }
  },

  async getTopProviders(dateRange, limit, customStartDate, customEndDate) {
    try {
      const providers = await reportsModel.getTopProviders(dateRange, limit, customStartDate, customEndDate);
      return providers;
    } catch (error) {
      throw new Error(`Failed to get top providers: ${error.message}`);
    }
  },

  async getTopCustomers(dateRange, limit, customStartDate, customEndDate) {
    try {
      const customers = await reportsModel.getTopCustomers(dateRange, limit, customStartDate, customEndDate);
      return customers;
    } catch (error) {
      throw new Error(`Failed to get top customers: ${error.message}`);
    }
  },

  async getAllReportsData(dateRange, customStartDate, customEndDate) {
    try {
      const [overviewStats, monthlyData, categoryBreakdown, topProviders, topCustomers] = await Promise.all([
        reportsModel.getOverviewStats(dateRange, customStartDate, customEndDate),
        reportsModel.getMonthlyData(dateRange, customStartDate, customEndDate),
        reportsModel.getCategoryBreakdown(dateRange, customStartDate, customEndDate),
        reportsModel.getTopProviders(dateRange, 5, customStartDate, customEndDate),
        reportsModel.getTopCustomers(dateRange, 5, customStartDate, customEndDate),
      ]);

      return {
        overviewStats,
        monthlyData,
        categoryBreakdown,
        topProviders,
        topCustomers,
      };
    } catch (error) {
      throw new Error(`Failed to get all reports data: ${error.message}`);
    }
  },

  async getCategoryDetails(category, dateRange, customStartDate, customEndDate) {
    try {
      const details = await reportsModel.getCategoryDetails(category, dateRange, customStartDate, customEndDate);
      return details;
    } catch (error) {
      throw new Error(`Failed to get category details: ${error.message}`);
    }
  },
};

