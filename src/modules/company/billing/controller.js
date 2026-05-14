// src/modules/company/billing/controller.js
import { FRIENDLY_500_MESSAGE } from "../../../utils/errors.js";
import { createAnalyticsPDF } from "../../../utils/billingReportPdf.js";
import { generateReceiptPDF } from "../../../utils/receiptPdf.js";
import {
  uploadFileToR2,
  generateFileKey,
  getPublicUrl,
  generatePresignedDownloadUrl,
  fileExistsInR2,
} from "../../../utils/r2.js";
import { prisma } from "../../../utils/prisma.js";
import { normalizeReportLocale } from "../../../utils/reportPdfI18n.js";
import { normalizeCurrencyCode } from "../../fx/service.js";
import {
  getBillingOverview,
  getTransactionsList,
  getInvoicesList,
  getUpcomingPayments,
  getPaymentDetailsService,
  buildBillingAnalyticsPdfData,
} from "./service.js";

async function getOverview(req, res) {
  try {
    const userId = req.user.userId;

    const data = await getBillingOverview(userId);
    res.json({ success: true, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: FRIENDLY_500_MESSAGE });
  }
}

async function getTransactions(req, res) {
  try {
    const userId = req.user.userId;
    const transactions = await getTransactionsList(userId);
    res.json({ success: true, transactions });
  } catch (err) {
    res.status(500).json({ success: false, message: FRIENDLY_500_MESSAGE });
  }
}

async function getInvoices(req, res) {
  try {
    const userId = req.user.userId;
    const invoices = await getInvoicesList(userId);
    res.json({ success: true, invoices });
  } catch (err) {
    res.status(500).json({ success: false, message: FRIENDLY_500_MESSAGE });
  }
}

export async function fetchUpcomingPayments(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized: Missing user ID" });
    }

    const data = await getUpcomingPayments(userId);

    if (!data.length) {
      return res
        .status(200)
        .json({ message: "No upcoming payments found", data: [] });
    }

    res.status(200).json({
      message: "Upcoming payments retrieved successfully",
      data,
    });
  } catch (error) {
    console.error("Error fetching upcoming payments:", error);
    res.status(500).json({ error: "Failed to fetch upcoming payments" });
  }
}

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
    const userId = req.user?.userId;
    const queryLocale =
      typeof req.query?.lang === "string" && req.query.lang.trim()
        ? req.query.lang.trim().toLowerCase()
        : "";
    const userSettings = await prisma.settings.findUnique({
      where: { userId },
      select: { locale: true, preferredCurrency: true },
    });

    const resolvedLocale = queryLocale || userSettings?.locale || "en";
    const preferredCurrency =
      typeof userSettings?.preferredCurrency === "string" &&
      userSettings.preferredCurrency.trim()
        ? userSettings.preferredCurrency.trim().toUpperCase()
        : undefined;


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
    const safeLocale = resolvedLocale.replace(/[^a-z-]/g, "").slice(0, 8) || "en";
    const safeCurrency =
      typeof preferredCurrency === "string" && /^[A-Z]{3}$/.test(preferredCurrency)
        ? preferredCurrency
        : "TXN";
    const r2Key = `receipts/${userId}/receipt-${sanitizedPaymentId}-${safeLocale}-${safeCurrency}.pdf`;

    // Check if file already exists in R2
    let downloadUrl;
    const fileExists = await fileExistsInR2(r2Key);

    if (!fileExists) {
      // File doesn't exist, generate and upload it
      // Get full payment data
      const payment = await getPaymentDetailsService(paymentId);

      // Generate PDF buffer
      const pdfBuffer = await generateReceiptPDF(payment, {
        locale: safeLocale,
        preferredCurrency,
      });

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

export const exportAnalyticsReport = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

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

    const payload = await buildBillingAnalyticsPdfData(
      userId,
      resolvedCurrency,
    );

    const pdfBuffer = await createAnalyticsPDF({
      ...payload,
      generatedFor: userId,
      generatedAt: new Date(),
      locale: resolvedLocale,
      displayCurrency: resolvedCurrency,
    });

    // Generate R2 key for the report
    const fileName = `billing-report-${Date.now()}.pdf`;
    const r2Key = generateFileKey("billing-reports", fileName, userId);

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
      message: "Analytics report generated and uploaded to R2 storage",
    });
  } catch (err) {
    console.error("Export report failed:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to export report",
      error: err.message,
    });
  }
};

export { getOverview, getTransactions, getInvoices };
