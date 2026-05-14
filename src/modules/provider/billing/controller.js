// controller.js
import { FRIENDLY_500_MESSAGE } from "../../../utils/errors.js";
import { generateReceiptPDF } from "../../../utils/receiptPdf.js";
import { createProviderEarningsPDF } from "../../../utils/providerEarningsReportPdf.js";
import { prisma } from "../../../utils/prisma.js";
import { normalizeReportLocale } from "../../../utils/reportPdfI18n.js";
import { normalizeCurrencyCode } from "../../fx/service.js";
import {
  uploadFileToR2,
  generateFileKey,
  getPublicUrl,
  generatePresignedDownloadUrl,
  fileExistsInR2,
} from "../../../utils/r2.js";
import {
  createPayoutMethod,
  deletePayoutMethod,
  getEarningsOverview,
  getPaymentDetailsService,
  getPayoutMethodById,
  getPayoutMethods,
  getProviderBillingData,
  getProviderProfileIdByUserId,
  updatePayoutMethod,
} from "./service.js";

export const getProviderBillingController = async (req, res) => {
  try {
    const providerId = req.user?.id; // ✅ Extracted from token

    if (!providerId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: No provider ID found",
      });
    }

    const data = await getProviderBillingData(providerId);
    res.json({ success: true, ...data });
  } catch (err) {
    console.error("Billing Error:", err);
    res.status(500).json({ success: false, message: FRIENDLY_500_MESSAGE });
  }
};

export const getEarningsOverviewController = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const timeFilter = req.query.timeFilter || "this-month";
    const payload = await getEarningsOverview(userId, timeFilter);

    return res.json(payload);
  } catch (err) {
    console.error("getEarningsOverviewController error:", err);
    return res
      .status(500)
      .json({ error: FRIENDLY_500_MESSAGE });
  }
};

export const getPaymentDetails = async (req, res, next) => {
  try {
    const { paymentId } = req.params;

    const details = await getPaymentDetailsService(paymentId);

    return res.status(200).json({
      success: true,
      message: "Payment details retrieved",
      data: details,
    });
  } catch (err) {
    // add status if not provided
    if (!err.status) err.status = 500;
    next(err);
  }
};

export const downloadReceipt = async (req, res, next) => {
  try {
    const { paymentId } = req.params;
    const userId = req.user?.id;
    const locale =
      typeof req.query?.lang === "string" && req.query.lang.trim()
        ? req.query.lang.trim().toLowerCase()
        : "en";

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Missing user ID",
      });
    }

    // Generate R2 key for the receipt (consistent key based on paymentId and userId)
    // Format: receipts/{userId}/receipt-{paymentId}.pdf
    // This ensures the same payment always uses the same key
    const sanitizedPaymentId = paymentId.replace(/[^a-zA-Z0-9._-]/g, "_");
    const safeLocale = locale.replace(/[^a-z-]/g, "").slice(0, 8) || "en";
    const r2Key = `receipts/${userId}/receipt-${sanitizedPaymentId}-${safeLocale}.pdf`;

    // Check if file already exists in R2
    let downloadUrl;
    const fileExists = await fileExistsInR2(r2Key);

    if (!fileExists) {
      // File doesn't exist, generate and upload it
      // Get full payment data
      const payment = await getPaymentDetailsService(paymentId);

      // Generate PDF buffer
      const pdfBuffer = await generateReceiptPDF(payment, { locale: safeLocale });

      // Upload PDF buffer to R2
      await uploadFileToR2(pdfBuffer, r2Key, "application/pdf");
    }

    // Get public URL or generate presigned URL
    try {
      downloadUrl = getPublicUrl(r2Key);
    } catch (error) {
      // If public URL is not configured, use presigned URL
      console.warn("R2 public URL not configured, using presigned URL:", r2Key);
      downloadUrl = await generatePresignedDownloadUrl(r2Key, 3600); // 1 hour expiry
    }

    // Return the URL for the frontend to navigate to
    return res.json({
      success: true,
      downloadUrl,
      message: fileExists
        ? "Receipt retrieved from storage"
        : "Receipt generated and uploaded to R2 storage",
    });
  } catch (err) {
    console.error("Error generating receipt:", err);
    if (!err.status) err.status = 500;
    next(err);
  }
};

// GET /payout-methods
export const getAllPayoutMethods = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const providerProfileId = await getProviderProfileIdByUserId(userId);
    if (!providerProfileId) {
      return res.status(404).json({ error: "Provider profile not found" });
    }

    const payoutMethods = await getPayoutMethods(providerProfileId);
    res.json({ payoutMethods });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch payout methods" });
  }
};

// POST /payout-methods
export async function createMethod(req, res) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Fetch provider profile
    const providerProfileId = await getProviderProfileIdByUserId(userId);
    if (!providerProfileId) {
      return res.status(404).json({ error: "Provider profile not found" });
    }

    const data = req.body;
    const method = await createPayoutMethod(providerProfileId, data);
    res.status(201).json(method);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create payout method." });
  }
}

// PUT /payout-methods/:id
export async function updateMethod(req, res) {
  try {
    const { id } = req.params;
    const data = req.body;
    const updated = await updatePayoutMethod(id, data);
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update payout method." });
  }
}

// DELETE /payout-methods/:id
export async function deleteMethod(req, res) {
  try {
    const { id } = req.params;
    const deleted = await deletePayoutMethod(id);
    res.json({ message: "Deleted successfully", deleted });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete payout method." });
  }
}

// GET /payout-methods/:id
export async function getMethod(req, res) {
  try {
    const { id } = req.params;
    const method = await getPayoutMethodById(id);
    if (!method) return res.status(404).json({ error: "Not found" });
    res.json(method);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch payout method." });
  }
}

// Export earnings analytics report
export const exportEarningsReport = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const timeFilter = req.query.timeFilter || "this-month";
    const queryLocale =
      typeof req.query?.lang === "string" && req.query.lang.trim()
        ? req.query.lang.trim()
        : "";
    const queryCurrency =
      typeof req.query?.currency === "string" && req.query.currency.trim()
        ? req.query.currency.trim().toUpperCase()
        : "";

    const userSettings = await prisma.settings.findUnique({
      where: { userId },
      select: { locale: true, preferredCurrency: true },
    });

    const resolvedLocale = normalizeReportLocale(
      queryLocale || userSettings?.locale || "en",
    );
    const fromSettings =
      normalizeCurrencyCode(userSettings?.preferredCurrency || "MYR") || "MYR";
    const resolvedCurrency =
      queryCurrency && /^[A-Z]{3}$/.test(queryCurrency)
        ? queryCurrency
        : fromSettings;

    const earningsData = await getEarningsOverview(userId, timeFilter);

    const pdfBuffer = await createProviderEarningsPDF({
      earningsData: earningsData.earningsData,
      recentPayments: earningsData.recentPayments || [],
      monthlyEarnings: earningsData.monthlyEarnings || [],
      topClients: earningsData.topClients || [],
      quickStats: earningsData.quickStats || {},
      generatedFor: userId,
      generatedAt: new Date(),
      locale: resolvedLocale,
      displayCurrency: resolvedCurrency,
    });

    // Generate R2 key for the report
    const fileName = `earnings-report-${Date.now()}.pdf`;
    const r2Key = generateFileKey("earnings-reports", fileName, userId);

    // Upload PDF buffer to R2
    await uploadFileToR2(pdfBuffer, r2Key, "application/pdf");

    // Get public URL or generate presigned URL
    let downloadUrl;
    try {
      downloadUrl = getPublicUrl(r2Key);
    } catch (error) {
      // If public URL is not configured, use presigned URL
      console.warn("R2 public URL not configured, using presigned URL:", r2Key);
      downloadUrl = await generatePresignedDownloadUrl(r2Key, 3600); // 1 hour expiry
    }

    // Return the download URL
    return res.json({
      success: true,
      downloadUrl,
      message: "Earnings report generated and uploaded to R2 storage",
    });
  } catch (err) {
    console.error("Export earnings report failed:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to export earnings report",
      error: err.message,
    });
  }
};
