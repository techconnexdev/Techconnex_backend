// src/modules/company/billing/controller.js
import { createAnalyticsPDF } from "../../../utils/billingReportPdf.js";
import { generateReceiptPDF } from "../../../utils/receiptPdf.js";
import {
  uploadFileToR2,
  generateFileKey,
  getPublicUrl,
  generatePresignedDownloadUrl,
} from "../../../utils/r2.js";
import {
  getBillingOverview,
  getTransactionsList,
  getInvoicesList,
  getUpcomingPayments,
  getPaymentDetailsService,
} from "./service.js";

async function getOverview(req, res) {
  try {
    const userId = req.user.userId;

    const data = await getBillingOverview(userId);
    res.json({ success: true, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function getTransactions(req, res) {
  try {
    const userId = req.user.userId;
    const transactions = await getTransactionsList(userId);
    res.json({ success: true, transactions });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function getInvoices(req, res) {
  try {
    const userId = req.user.userId;
    const invoices = await getInvoicesList(userId);
    res.json({ success: true, invoices });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
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

    // Get full payment data
    const payment = await getPaymentDetailsService(paymentId);

    // Generate PDF buffer
    const pdfBuffer = await generateReceiptPDF(payment);

    // Generate R2 key for the receipt
    const fileName = `receipt-${paymentId}.pdf`;
    const r2Key = generateFileKey("receipts", fileName, userId);

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

    // Redirect to R2 URL or return the URL
    return res.json({
      success: true,
      downloadUrl,
      message: "Receipt generated and uploaded to R2 storage",
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

    // Fetch all analytics data
    const [overview, transactions, invoices, upcoming] = await Promise.all([
      getBillingOverview(userId),
      getTransactionsList(userId),
      getInvoicesList(userId),
      getUpcomingPayments(userId),
    ]);

    // Generate PDF buffer
    const pdfBuffer = await createAnalyticsPDF({
      overview,
      transactions,
      invoices,
      upcoming,
      generatedFor: userId,
      generatedAt: new Date(),
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
