import { paymentModel } from "./model.js";
import { confirmBankTransfer } from "../../payment/service.js";
import {
  convertWithSnapshot,
  fetchLatestFxSnapshot,
  normalizeCurrencyCode,
} from "../../fx/service.js";

/** Stats aggregates are MYR-normalized in the model; convert for admin display. */
async function applyStatsDisplayCurrency(stats, requestedCurrency) {
  const target = normalizeCurrencyCode(requestedCurrency);
  if (!target || target === "MYR") {
    return { ...stats, displayCurrency: "MYR" };
  }

  try {
    const { ratesMap } = await fetchLatestFxSnapshot();
    if (!ratesMap || !ratesMap[target]) {
      return {
        ...stats,
        displayCurrency: "MYR",
        displayCurrencyFallback: true,
      };
    }

    const convertMyr = (myrAmount) => {
      const raw = Number(myrAmount);
      if (!Number.isFinite(raw)) return raw;
      const v = convertWithSnapshot({
        amount: raw,
        fromCurrencyCode: "MYR",
        toCurrencyCode: target,
        ratesMap,
      });
      return v != null ? Number(v.toFixed(2)) : raw;
    };

    return {
      ...stats,
      totalVolume: convertMyr(stats.totalVolume),
      totalFees: convertMyr(stats.totalFees),
      netWorth: convertMyr(stats.netWorth),
      totalRevenue: convertMyr(stats.totalRevenue ?? 0),
      displayCurrency: target,
    };
  } catch {
    return {
      ...stats,
      displayCurrency: "MYR",
      displayCurrencyFallback: true,
    };
  }
}

export const paymentService = {
  /**
   * Get all payments with filters
   */
  async getAllPayments(filters = {}) {
    try {
      const result = await paymentModel.getAllPayments(filters);
      return result;
    } catch (error) {
      throw new Error(`Failed to get payments: ${error.message}`);
    }
  },

  /**
   * Get payment by ID with all details
   */
  async getPaymentById(paymentId) {
    try {
      const payment = await paymentModel.getPaymentById(paymentId);
      if (!payment) {
        throw new Error("Payment not found");
      }
      return payment;
    } catch (error) {
      throw new Error(`Failed to get payment: ${error.message}`);
    }
  },

  /**
   * Get payments ready for transfer
   */
  async getReadyToTransferPayments() {
    try {
      const payments = await paymentModel.getReadyToTransferPayments();
      return payments;
    } catch (error) {
      throw new Error(`Failed to get ready to transfer payments: ${error.message}`);
    }
  },

  /**
   * Get payment statistics (amounts MYR-normalized; optionally converted for display).
   * @param {string} [displayCurrency] - ISO 4217 code (e.g. USD); omit or MYR for ringgit.
   */
  async getPaymentStats(displayCurrency) {
    try {
      const stats = await paymentModel.getPaymentStats();
      // Also get revenue stats (total revenue from TRANSFERRED payments)
      const revenueStats = await paymentModel.getRevenueStats();
      const merged = {
        ...stats,
        totalRevenue: revenueStats.totalRevenue,
      };
      return applyStatsDisplayCurrency(merged, displayCurrency);
    } catch (error) {
      throw new Error(`Failed to get payment stats: ${error.message}`);
    }
  },

  /**
   * Get revenue statistics (total revenue and growth rate)
   */
  async getRevenueStats() {
    try {
      const stats = await paymentModel.getRevenueStats();
      return stats;
    } catch (error) {
      throw new Error(`Failed to get revenue stats: ${error.message}`);
    }
  },

  /**
   * Confirm bank transfer (mark payment as transferred)
   */
  async confirmBankTransfer(paymentId, adminId, transferRef, filePath = null) {
    try {
      // If file path is provided, use it as the bankTransferRef, otherwise use transferRef
      const finalTransferRef = filePath || transferRef;
      const result = await confirmBankTransfer(paymentId, adminId, finalTransferRef);
      return result;
    } catch (error) {
      throw new Error(`Failed to confirm bank transfer: ${error.message}`);
    }
  },
};

