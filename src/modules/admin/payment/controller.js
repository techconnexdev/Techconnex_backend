import { paymentService } from "./service.js";
import { generateReceiptPDF } from "../../../utils/receiptPdf.js";
import {
  uploadFileToR2,
  generateFileKey,
  getPublicUrl,
  generatePresignedDownloadUrl,
  fileExistsInR2,
} from "../../../utils/r2.js";
import { prisma } from "../../../utils/prisma.js";

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
        dateFrom,
        dateTo,
        participant,
        transfer,
        page = 1,
        limit = 50,
        sortBy = "createdAt",
        sortOrder = "desc",
      } = req.query;

      const rawLimit = Number.parseInt(String(limit), 10);
      const safeLimit = Number.isFinite(rawLimit)
        ? Math.min(Math.max(rawLimit, 1), 10000)
        : 50;
      const rawPage = Number.parseInt(String(page), 10);
      const safePage = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;

      const filters = {
        search,
        status,
        method,
        dateFrom,
        dateTo,
        participant,
        transfer,
        page: safePage,
        limit: safeLimit,
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
      const currency =
        typeof req.query.currency === "string"
          ? req.query.currency.trim().toUpperCase()
          : "";
      const stats = await paymentService.getPaymentStats(currency || undefined);
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
   * GET /admin/payments/revenue-stats
   * Get revenue statistics (total revenue and growth rate)
   */
  async getRevenueStats(req, res) {
    try {
      const stats = await paymentService.getRevenueStats();
      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error("Get revenue stats error:", error);
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

  /**
   * GET /admin/payments/:id/receipt
   * Download receipt for a payment
   */
  async downloadReceipt(req, res) {
    try {
      const { id } = req.params;
      const queryLocale =
        typeof req.query?.lang === "string" && req.query.lang.trim()
          ? req.query.lang.trim().toLowerCase()
          : "";
      const requesterId = req.user?.id || req.user?.userId;

      const settings = requesterId
        ? await prisma.settings.findUnique({
            where: { userId: requesterId },
            select: { locale: true, preferredCurrency: true },
          })
        : null;

      const resolvedLocale = queryLocale || settings?.locale || "en";
      const preferredCurrency =
        typeof settings?.preferredCurrency === "string" &&
        settings.preferredCurrency.trim()
          ? settings.preferredCurrency.trim().toUpperCase()
          : undefined;

      // Get payment details
      const payment = await paymentService.getPaymentById(id);

      if (!payment) {
        return res.status(404).json({
          success: false,
          message: "Payment not found",
        });
      }

      // Generate R2 key for the receipt (consistent key based on paymentId)
      // Format: receipts/admin/receipt-{paymentId}.pdf
      const sanitizedPaymentId = id.replace(/[^a-zA-Z0-9]/g, "-");
      const safeLocale = resolvedLocale.replace(/[^a-z-]/g, "").slice(0, 8) || "en";
      const safeCurrency =
        typeof preferredCurrency === "string" && /^[A-Z]{3}$/.test(preferredCurrency)
          ? preferredCurrency
          : "TXN";
      const r2Key = `receipts/admin/receipt-${sanitizedPaymentId}-${safeLocale}-${safeCurrency}.pdf`;

      // Check if receipt already exists in R2
      const exists = await fileExistsInR2(r2Key);

      if (exists) {
        // Generate presigned download URL (valid for 1 hour)
        const downloadUrl = await generatePresignedDownloadUrl(r2Key, 3600);
        return res.json({
          success: true,
          downloadUrl,
          message: "Receipt retrieved from storage",
        });
      }

      // Generate PDF receipt
      const pdfBuffer = await generateReceiptPDF(payment, {
        locale: safeLocale,
        preferredCurrency,
      });

      // Upload to R2
      await uploadFileToR2(pdfBuffer, r2Key, "application/pdf");

      // Generate presigned download URL (valid for 1 hour)
      const downloadUrl = await generatePresignedDownloadUrl(r2Key, 3600);

      res.json({
        success: true,
        downloadUrl,
        message: "Receipt generated and uploaded to R2 storage",
      });
    } catch (error) {
      console.error("Error generating receipt:", error);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  },
};
