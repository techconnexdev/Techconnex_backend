// src/modules/company/billing/service.js
import {
  getTotalSpent,
  getPendingPayments,
  getThisMonthSpent,
  getAverageTransaction,
  getRecentInvoices,
  getRecentTransactions,
  getAllTransactions,
  getAllInvoices,
  findUpcomingPayments,
  findPaymentWithFullDetails,
} from "./model.js";

function getMonthRange() {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { firstDay, lastDay };
}

async function getBillingOverview(userId) {
  const { firstDay, lastDay } = getMonthRange();

  const [totalSpent, pending, monthly, avg, invoices, transactions] =
    await Promise.all([
      getTotalSpent(userId),
      getPendingPayments(userId),
      getThisMonthSpent(userId, firstDay, lastDay),
      getAverageTransaction(userId),
      getRecentInvoices(userId),
      getRecentTransactions(userId),
    ]);

  return {
    totalSpent: totalSpent._sum.amount || 0,
    pendingPayments: pending._sum.amount || 0,
    thisMonthSpent: monthly._sum.amount || 0,
    averageTransaction: avg._avg.amount || 0,
    recentInvoices: invoices,
    recentTransactions: transactions,
  };
}

async function getTransactionsList(userId) {
  return getAllTransactions(userId);
}

async function getInvoicesList(userId) {
  return getAllInvoices(userId);
}

export const getUpcomingPayments = async (userId) => {
  const currentDate = new Date();

  // Call the Prisma query from model
  const projects = await findUpcomingPayments(userId, currentDate);

  // Optional: transform or sort results if needed
  return projects;
};

export const getPaymentDetailsService = async (paymentId) => {
  if (!paymentId) {
    const error = new Error("paymentId is required");
    error.status = 400;
    throw error;
  }

  const payment = await findPaymentWithFullDetails(paymentId);

  if (!payment) {
    const error = new Error("Payment not found");
    error.status = 404;
    throw error;
  }

  // Example: normalize Decimal/BigInt -> numbers for JSON consumers
  const normalizeDecimal = (d) => {
    if (d === null || d === undefined) return d;
    // prisma Decimal might be returned as string; try Number safely
    const n = Number(d);
    return Number.isFinite(n) ? n : d;
  };

  // Post-process top-level amounts
  payment.amount = normalizeDecimal(payment.amount);
  payment.platformFeeAmount = normalizeDecimal(payment.platformFeeAmount);
  payment.providerAmount = normalizeDecimal(payment.providerAmount);

  // Normalize nested fields (project -> providerProfile -> totalEarnings, rating, etc.)
  try {
    if (payment.project?.provider?.providerProfile) {
      const p = payment.project.provider.providerProfile;
      p.totalEarnings = normalizeDecimal(p.totalEarnings);
      p.rating = normalizeDecimal(p.rating);
      p.minimumProjectBudget = normalizeDecimal(p.minimumProjectBudget);
      p.maximumProjectBudget = normalizeDecimal(p.maximumProjectBudget);
    }

    if (payment.project?.customer?.customerProfile) {
      const c = payment.project.customer.customerProfile;
      c.totalSpend = normalizeDecimal(c.totalSpend);
      c.annualRevenue = normalizeDecimal(c.annualRevenue);
    }
  } catch (e) {
    // non-fatal; continue returning raw values
    console.warn("Post-process normalization failed:", e);
  }

  // Optionally: redact sensitive bank fields for provider (unless admin)
  // e.g. delete payment.project.provider.providerProfile.bankAccountNumber;

  return payment;
};

export { getBillingOverview, getTransactionsList, getInvoicesList };
