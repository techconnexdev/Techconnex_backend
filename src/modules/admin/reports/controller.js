import { reportsService } from "./service.js";
import { generateReportPDF } from "./pdfGenerator.js";

export const reportsController = {
  async getOverviewStats(req, res) {
    try {
      const { dateRange, startDate, endDate } = req.query;
      const stats = await reportsService.getOverviewStats(
        dateRange || "last_30_days",
        startDate || null,
        endDate || null
      );

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

  async getMonthlyData(req, res) {
    try {
      const { dateRange, startDate, endDate } = req.query;
      const data = await reportsService.getMonthlyData(
        dateRange || "last_6_months",
        startDate || null,
        endDate || null
      );

      res.json({
        success: true,
        data,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },

  async getCategoryBreakdown(req, res) {
    try {
      const { dateRange, startDate, endDate } = req.query;
      const breakdown = await reportsService.getCategoryBreakdown(
        dateRange || "last_30_days",
        startDate || null,
        endDate || null
      );

      res.json({
        success: true,
        data: breakdown,
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
      const { dateRange, limit, startDate, endDate } = req.query;
      const providers = await reportsService.getTopProviders(
        dateRange || "last_30_days",
        limit ? parseInt(limit) : 5,
        startDate || null,
        endDate || null
      );

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

  async getTopCustomers(req, res) {
    try {
      const { dateRange, limit, startDate, endDate } = req.query;
      const customers = await reportsService.getTopCustomers(
        dateRange || "last_30_days",
        limit ? parseInt(limit) : 5,
        startDate || null,
        endDate || null
      );

      res.json({
        success: true,
        data: customers,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },

  async getAllReportsData(req, res) {
    try {
      const { dateRange, startDate, endDate } = req.query;
      const data = await reportsService.getAllReportsData(
        dateRange || "last_30_days",
        startDate || null,
        endDate || null
      );

      res.json({
        success: true,
        data,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },

  async getCategoryDetails(req, res) {
    try {
      const { category } = req.params;
      const { dateRange, startDate, endDate } = req.query;
      
      if (!category) {
        return res.status(400).json({
          success: false,
          error: "Category parameter is required",
        });
      }

      const details = await reportsService.getCategoryDetails(
        decodeURIComponent(category),
        dateRange || "last_30_days",
        startDate || null,
        endDate || null
      );

      res.json({
        success: true,
        data: details,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },

  async exportReport(req, res) {
    try {
      const { reportType, dateRange, startDate, endDate, format = "pdf" } = req.query;

      let data;
      if (reportType === "overview" || !reportType) {
        data = await reportsService.getAllReportsData(
          dateRange || "last_30_days",
          startDate || null,
          endDate || null
        );
      } else {
        // For specific report types, fetch only that data
        switch (reportType) {
          case "financial":
            data = {
              overviewStats: await reportsService.getOverviewStats(dateRange, startDate, endDate),
              categoryBreakdown: await reportsService.getCategoryBreakdown(dateRange, startDate, endDate),
              monthlyData: await reportsService.getMonthlyData(dateRange, startDate, endDate),
            };
            break;
          case "user_activity":
            data = {
              overviewStats: await reportsService.getOverviewStats(dateRange, startDate, endDate),
              monthlyData: await reportsService.getMonthlyData(dateRange, startDate, endDate),
            };
            break;
          case "project_performance":
            data = {
              overviewStats: await reportsService.getOverviewStats(dateRange, startDate, endDate),
              categoryBreakdown: await reportsService.getCategoryBreakdown(dateRange, startDate, endDate),
              topProviders: await reportsService.getTopProviders(dateRange, 10, startDate, endDate),
            };
            break;
          case "provider_analytics":
            data = {
              topProviders: await reportsService.getTopProviders(dateRange, 20, startDate, endDate),
              categoryBreakdown: await reportsService.getCategoryBreakdown(dateRange, startDate, endDate),
            };
            break;
          default:
            data = await reportsService.getAllReportsData(dateRange, startDate, endDate);
        }
      }

      if (format === "pdf") {
        try {
          const pdfBuffer = await generateReportPDF(data, reportType, dateRange || "last_30_days");
          
          res.setHeader("Content-Type", "application/pdf");
          res.setHeader(
            "Content-Disposition",
            `attachment; filename="report-${reportType}-${Date.now()}.pdf"`
          );
          res.setHeader("Content-Length", pdfBuffer.length);
          
          res.send(pdfBuffer);
        } catch (error) {
          res.status(500).json({
            success: false,
            error: `Failed to generate PDF: ${error.message}`,
          });
        }
      } else if (format === "csv") {
        // Simple CSV export (can be enhanced)
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", `attachment; filename="report-${Date.now()}.csv"`);
        // For now, return JSON as CSV would need proper formatting
        res.json({ success: true, data, message: "CSV export not yet implemented, returning JSON" });
      } else {
        res.json({
          success: true,
          data,
          exportedAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },
};

