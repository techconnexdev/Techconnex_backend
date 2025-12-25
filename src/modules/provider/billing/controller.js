// controller.js
import { generateReceiptPDF } from "../../../utils/receiptPdf.js";
import { createProviderEarningsPDF } from "../../../utils/providerEarningsReportPdf.js";
import { uploadFileToR2, generateFileKey, getPublicUrl, generatePresignedDownloadUrl } from "../../../utils/r2.js";
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
      return res
        .status(401)
        .json({
          success: false,
          message: "Unauthorized: No provider ID found",
        });
    }

    const data = await getProviderBillingData(providerId);
    res.json({ success: true, ...data });
  } catch (err) {
    console.error("Billing Error:", err);
    res.status(500).json({ success: false, message: err.message });
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
      .json({ error: "Server error", details: err.message });
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

    // Fetch earnings overview data
    const earningsData = await getEarningsOverview(userId, timeFilter);

    // Generate PDF buffer
    const pdfBuffer = await createProviderEarningsPDF({
      earningsData: earningsData.earningsData,
      recentPayments: earningsData.recentPayments || [],
      monthlyEarnings: earningsData.monthlyEarnings || [],
      topClients: earningsData.topClients || [],
      quickStats: earningsData.quickStats || {},
      generatedFor: userId,
      generatedAt: new Date().toLocaleString(),
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
