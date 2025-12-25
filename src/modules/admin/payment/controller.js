import { paymentService } from "./service.js";

export const paymentController = {
  /**
   * GET /admin/payments
   * Get all payments with filters
   */
  async getAllPayments(req, res) {
    try {
      const {
        search,
        status,
        method,
        page = 1,
        limit = 50,
        sortBy = "createdAt",
        sortOrder = "desc",
      } = req.query;

      const filters = {
        search,
        status,
        method,
        page: parseInt(page),
        limit: parseInt(limit),
        sortBy,
        sortOrder,
      };

      const result = await paymentService.getAllPayments(filters);

      res.json({
        success: true,
        data: result.payments,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
        },
      });
    } catch (error) {
      console.error("Get all payments error:", error);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  },

  /**
   * GET /admin/payments/stats
   * Get payment statistics
   */
  async getPaymentStats(req, res) {
    try {
      const stats = await paymentService.getPaymentStats();
      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error("Get payment stats error:", error);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  },

  /**
   * GET /admin/payments/ready-to-transfer
   * Get payments ready for bank transfer
   */
  async getReadyToTransferPayments(req, res) {
    try {
      const payments = await paymentService.getReadyToTransferPayments();
      res.json({
        success: true,
        data: payments,
      });
    } catch (error) {
      console.error("Get ready to transfer payments error:", error);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  },

  /**
   * GET /admin/payments/:id
   * Get payment by ID with all details
   */
  async getPaymentById(req, res) {
    try {
      const { id } = req.params;
      const payment = await paymentService.getPaymentById(id);

      res.json({
        success: true,
        data: payment,
      });
    } catch (error) {
      console.error("Get payment by ID error:", error);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  },

  /**
   * POST /admin/payments/:id/confirm-transfer
   * Confirm bank transfer completion with optional file upload
   */
  async confirmBankTransfer(req, res) {
    try {
      const { id } = req.params;
      const { transferRef } = req.body;
      const adminId = req.user.id;

      // Get R2 URL if file was uploaded
      let r2Url = null;
      if (req.file && req.file.r2Url) {
        r2Url = req.file.r2Url;
      }

      const result = await paymentService.confirmBankTransfer(
        id,
        adminId,
        transferRef,
        r2Url
      );

      res.json({
        success: true,
        data: result,
        message: "Bank transfer confirmed successfully",
      });
    } catch (error) {
      console.error("Confirm bank transfer error:", error);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  },
};
