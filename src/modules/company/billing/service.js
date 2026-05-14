// src/modules/company/billing/service.js
import {
  getTotalSpent,
  getPendingPayments,
  getThisMonthSpent,
  getAverageTransactionByYear,
  getRecentInvoices,
  getRecentTransactions,
  getAllTransactions,
  getAllInvoices,
  findUpcomingPayments,
  findPaymentWithFullDetails,
} from "./model.js";
import { convertWithSnapshot, normalizeCurrencyCode } from "../../fx/service.js";

function getMonthRange() {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { firstDay, lastDay };
}

async function getBillingOverview(userId) {
  const { firstDay, lastDay } = getMonthRange();

  const [totalSpent, pending, monthly, avgByYear, invoices, transactions] =
    await Promise.all([
      getTotalSpent(userId),
      getPendingPayments(userId),
      getThisMonthSpent(userId, firstDay, lastDay),
      getAverageTransactionByYear(userId),
      getRecentInvoices(userId),
      getRecentTransactions(userId),
    ]);

  const currentYear = new Date().getFullYear();
  const currentYearRow = avgByYear.find((r) => r.year === currentYear);
  const averageTransaction = currentYearRow ? currentYearRow.average : (avgByYear[0]?.average ?? 0);

  return {
    totalSpent: totalSpent._sum.amount || 0,
    pendingPayments: pending._sum.amount || 0,
    thisMonthSpent: monthly._sum.amount || 0,
    averageTransaction,
    averageTransactionByYear: avgByYear,
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

function getCustomerListAmount(payment) {
  const status = String(payment.status || "").toLowerCase();
  const isPendingLike = ["pending", "in_progress", "processing"].includes(status);
  const milestoneAmount = Number(payment.milestone?.amount || 0);
  const rawAmount = Number(payment.amount || 0);
  if (isPendingLike) {
    return Number((milestoneAmount * 1.05).toFixed(2));
  }
  return rawAmount;
}

function convertCustomerAmount(amount, project, displayCurrency) {
  const from =
    normalizeCurrencyCode(project?.currencyCode || "MYR") || "MYR";
  const to = normalizeCurrencyCode(displayCurrency) || "MYR";
  const value = Number(amount || 0);
  if (!Number.isFinite(value)) return 0;
  if (from === to) return value;
  const converted = convertWithSnapshot({
    amount: value,
    fromCurrencyCode: from,
    toCurrencyCode: to,
    ratesMap: project?.fxSnapshotRatesJson || null,
  });
  return converted == null ? value : Number(converted);
}

/**
 * Analytics payload for PDF export: amounts in the customer's display currency,
 * matching the customer billing page preferred-currency logic.
 */
export async function buildBillingAnalyticsPdfData(userId, displayCurrencyCode) {
  const displayCurrency =
    normalizeCurrencyCode(displayCurrencyCode) || "MYR";
  const payments = await getAllTransactions(userId);
  const currentDate = new Date();
  const upcomingProjects = await findUpcomingPayments(userId, currentDate);

  const mapped = payments.map((txn) => {
    const status = String(txn.status || "").toLowerCase();
    const isRefunded = status === "refunded";
    const baseAmount = getCustomerListAmount(txn);
    const project = txn.project;
    const displayAmount = convertCustomerAmount(
      baseAmount,
      project,
      displayCurrency,
    );
    return {
      id: txn.id,
      displayAmount,
      status,
      type: isRefunded ? "refund" : "payment",
      createdAt: txn.createdAt,
      projectTitle: project?.title || "",
    };
  });

  const transactionItems = mapped.filter((t) => t.type !== "refund");
  const now = new Date();
  const isIncludedSpent = (s) =>
    ["transferred", "escrow", "escrowed"].includes(s);
  const isIncludedPending = (s) =>
    ["pending", "escrow", "escrowed"].includes(s);

  const totalSpent = transactionItems
    .filter((t) => isIncludedSpent(t.status))
    .reduce((sum, t) => sum + t.displayAmount, 0);

  const thisMonthSpent = transactionItems
    .filter((t) => {
      const d = new Date(t.createdAt);
      return (
        isIncludedSpent(t.status) &&
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear()
      );
    })
    .reduce((sum, t) => sum + t.displayAmount, 0);

  const pendingPayments = transactionItems
    .filter((t) => isIncludedPending(t.status))
    .reduce((sum, t) => sum + t.displayAmount, 0);

  const averageTransaction =
    transactionItems.length > 0
      ? totalSpent / transactionItems.length
      : 0;

  const transactionsForPdf = mapped.slice(0, 100).map((t) => ({
    displayAmount: t.displayAmount,
    projectTitle: t.projectTitle,
    createdAt: t.createdAt,
    status: t.status,
  }));

  const upcomingRows = [];
  for (const proj of upcomingProjects) {
    const pc = normalizeCurrencyCode(proj.currencyCode) || "MYR";
    for (const m of proj.milestones || []) {
      const raw = Number(m.amount || 0);
      const converted = convertCustomerAmount(raw, proj, displayCurrency);
      upcomingRows.push({
        projectTitle: proj.title || "",
        projectStatus: String(proj.status || ""),
        milestoneTitle: m.title || "",
        amount: converted,
      });
    }
  }

  return {
    overview: {
      totalSpent,
      thisMonthSpent,
      pendingPayments,
      averageTransaction,
    },
    transactions: transactionsForPdf,
    upcomingRows,
    displayCurrency,
  };
}

export { getBillingOverview, getTransactionsList, getInvoicesList };
