// service.js
import {
  getProviderEarningsSummary,
  getRecentPayments,
  getMonthlyEarnings,
  getTopClients,
  findPaymentWithFullDetails,
} from "./model.js";
// model.js
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function getProviderProfileIdByUserId(userId) {
  const profile = await prisma.providerProfile.findUnique({
    where: { userId },
    select: { id: true }
  });
  return profile?.id || null;
}

export const getProviderBillingData = async (providerId) => {
  const [summary, recent, monthly, topClients] = await Promise.all([
    getProviderEarningsSummary(providerId),
    getRecentPayments(providerId),
    getMonthlyEarnings(providerId),
    getTopClients(providerId),
  ]);

  // Example derived stats
  const monthlyGrowth = 12.5;
  const averageProjectValue =
    recent.length > 0
      ? recent.reduce((sum, p) => sum + p.amount, 0) / recent.length
      : 0;

  return {
    earningsData: {
      totalEarnings: summary.totalEarnings,
      pendingPayments: summary.pendingPayments,
      availableBalance: summary.availableBalance,
      thisMonth: monthly.length > 0 ? monthly[monthly.length - 1].amount : 0,
      monthlyGrowth,
      averageProjectValue,
    },
    recentPayments: recent.map((p) => ({
      id: p.id,
      project: p.project.title,
      client: p.project.customer.name,
      amount: p.amount,
      status: p.status.toLowerCase(),
      date: p.createdAt.toISOString().split("T")[0],
      milestone: p.milestone?.title || "N/A",
    })),
    monthlyEarnings: monthly,
    topClients,
  };
};

/**
 * Helper: start/end of day helper
 */
const startOfDay = (d) => {
  const dt = new Date(d);
  dt.setHours(0, 0, 0, 0);
  return dt;
};
const endOfDay = (d) => {
  const dt = new Date(d);
  dt.setHours(23, 59, 59, 999);
  return dt;
};

/**
 * Return aggregated earnings overview for a provider (userId).
 * timeFilter: "this-week" | "this-month" | "last-month" | "this-year"
 */
export async function getEarningsOverview(userId, timeFilter = "this-month") {
  const provider = await prisma.providerProfile.findUnique({
    where: { userId },
    include: {
      payoutMethods: true, // include all payout methods
    },
  });

  // 1. get provider projects
  const projects = await prisma.project.findMany({
    where: { providerId: userId },
    select: { id: true, customerId: true, title: true },
  });
  const projectIds = projects.map((p) => p.id);

  // If provider has no projects, return empty defaults
  if (projectIds.length === 0) {
    return {
      earningsData: {
        totalEarnings: 0,
        thisMonth: 0,
        monthlyGrowth: 0,
        pendingPayments: 0,
        availableBalance: 0,
        averageProjectValue: 0,
      },
      recentPayments: [],
      monthlyEarnings: [],
      topClients: [],
      quickStats: {
        projectsThisMonth: 0,
        successRate: 0,
        repeatClientsPercent: 0,
      },
    };
  }

  // 2. fetch payments for these projects (limit for recent)
  const payments = await prisma.payment.findMany({
    where: { projectId: { in: projectIds } },
    include: {
      project: { select: { id: true, title: true, customerId: true } },
      milestone: { select: { id: true, title: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  // Normalize numeric values helper
  const toNum = (v) => (v == null ? 0 : Number(v));

  // 3. Totals & balances
  // totalEarnings: sum of providerAmount for payments that were TRANSFERRED (or REFUNDED excluded)
  const totalEarnings = payments
    .filter((p) =>
      ["TRANSFERRED", "RELEASED", "REFUNDED"].includes(p.status)
        ? p.status !== "REFUNDED"
        : ["TRANSFERRED", "RELEASED"].includes(p.status)
    )
    .reduce((s, p) => s + toNum(p.providerAmount || p.amount || 0), 0);

  // availableBalance: released but not yet transferred -> statuses RELEASED (ready for payout)
  const availableBalance = payments
    .filter((p) => p.status === "RELEASED")
    .reduce((s, p) => s + toNum(p.providerAmount || p.amount || 0), 0);

  // pendingPayments: payments that are ESCROWED or PENDING (not yet released)
  const pendingPayments = payments
    .filter((p) => ["PENDING", "IN_PROGRESS", "ESCROWED"].includes(p.status))
    .reduce((s, p) => s + toNum(p.providerAmount || p.amount || 0), 0);

  // 4. thisMonth: sum providerAmount for payments released/transferred in current month
  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth(); // 0-index
  const startOfThisMonth = new Date(curYear, curMonth, 1, 0, 0, 0);
  const endOfThisMonth = new Date(curYear, curMonth + 1, 0, 23, 59, 59, 999);

  const thisMonth = payments
    .filter((p) => {
      const date = p.releasedAt || p.createdAt || p.updatedAt;
      if (!date) return false;
      const d = new Date(date);
      return (
        d >= startOfThisMonth &&
        d <= endOfThisMonth &&
        ["RELEASED", "TRANSFERRED"].includes(p.status)
      );
    })
    .reduce((s, p) => s + toNum(p.providerAmount || p.amount || 0), 0);

  // 5. monthlyGrowth: compare thisMonth vs previous month
  const prevMonthStart = new Date(curYear, curMonth - 1, 1);
  const prevMonthEnd = new Date(curYear, curMonth, 0, 23, 59, 59, 999);
  const prevMonthTotal = payments
    .filter((p) => {
      const date = p.releasedAt || p.createdAt || p.updatedAt;
      if (!date) return false;
      const d = new Date(date);
      return (
        d >= prevMonthStart &&
        d <= prevMonthEnd &&
        ["RELEASED", "TRANSFERRED"].includes(p.status)
      );
    })
    .reduce((s, p) => s + toNum(p.providerAmount || p.amount || 0), 0);

  const monthlyGrowth =
    prevMonthTotal === 0
      ? thisMonth > 0
        ? 100
        : 0
      : ((thisMonth - prevMonthTotal) / prevMonthTotal) * 100;

  // 6. recentPayments mapping for UI (slice to 20)
  const recentPayments = payments.slice(0, 20).map((p) => ({
    id: p.id,
    project: p.project?.title || "Unknown project",
    clientId: p.project?.customerId || null,
    client: p.project?.customerId || "Client",
    milestone: p.milestone?.title || null,
    amount: toNum(p.providerAmount || p.amount || 0),
    currency: p.currency,
    status: p.status,
    date:
      p.releasedAt || p.createdAt || p.updatedAt
        ? new Date(p.releasedAt || p.createdAt || p.updatedAt).toISOString()
        : null,
    stripePaymentIntentId: p.stripePaymentIntentId,
  }));

  // 7. monthlyEarnings (last 12 months)
  const monthlyEarnings = [];
  for (let i = 11; i >= 0; i--) {
    const dt = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const start = new Date(dt.getFullYear(), dt.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(
      dt.getFullYear(),
      dt.getMonth() + 1,
      0,
      23,
      59,
      59,
      999
    );

    const amount = payments
      .filter((p) => {
        const date = p.releasedAt || p.createdAt || p.updatedAt;
        if (!date) return false;
        const d = new Date(date);
        return (
          d >= start &&
          d <= end &&
          ["RELEASED", "TRANSFERRED"].includes(p.status)
        );
      })
      .reduce((s, p) => s + toNum(p.providerAmount || p.amount || 0), 0);

    monthlyEarnings.push({
      month: start.toLocaleString("en-US", { month: "short", year: "numeric" }), // e.g. "Nov 2025"
      amount,
      projects: payments.filter((p) => {
        const date = p.releasedAt || p.createdAt || p.updatedAt;
        if (!date) return false;
        const d = new Date(date);
        return (
          d >= start &&
          d <= end &&
          ["RELEASED", "TRANSFERRED"].includes(p.status)
        );
      }).length,
    });
  }

  // 8. topClients: by total paid to provider (group by project.customerId)
  const clientMap = new Map();
  for (const p of payments) {
    const cid = p.project?.customerId || "unknown";
    const amt = toNum(p.providerAmount || p.amount || 0);
    if (!clientMap.has(cid))
      clientMap.set(cid, { clientId: cid, totalPaid: 0, projects: new Set() });
    const rec = clientMap.get(cid);
    rec.totalPaid += amt;
    rec.projects.add(p.project?.id || p.projectId);
    clientMap.set(cid, rec);
  }
  const topClients = Array.from(clientMap.values())
    .map((c) => ({
      clientId: c.clientId,
      totalPaid: c.totalPaid,
      projects: c.projects.size,
    }))
    .sort((a, b) => b.totalPaid - a.totalPaid)
    .slice(0, 8);

  // 9. quickStats
  const averageProjectValue = (() => {
    const projectSums = new Map(); // projectId -> total provider amount
    for (const p of payments) {
      const pid = p.projectId;
      projectSums.set(
        pid,
        (projectSums.get(pid) || 0) + toNum(p.providerAmount || p.amount || 0)
      );
    }
    const vals = Array.from(projectSums.values());
    if (vals.length === 0) return 0;
    return vals.reduce((s, v) => s + v, 0) / vals.length;
  })();

  const projectsThisMonth = projects.filter((proj) => {
    // we count projects that had any payment released this month OR project updated this month
    const projectPayments = payments.filter((p) => p.projectId === proj.id);
    return projectPayments.some((p) => {
      const date = p.releasedAt || p.createdAt || p.updatedAt;
      if (!date) return false;
      const d = new Date(date);
      return d >= startOfThisMonth && d <= endOfThisMonth;
    });
  }).length;

  // successRate: approximate from projects' status (COMPLETED / total)
  const totalProjectsCount = projects.length;
  const completedProjects = await prisma.project.count({
    where: { providerId: userId, status: "COMPLETED" },
  });
  const successRate =
    totalProjectsCount === 0
      ? 0
      : (completedProjects / totalProjectsCount) * 100;

  // repeatClientsPercent: percent of payments coming from repeat clients
  const clientsByPayments = {};
  for (const p of payments) {
    const cid = p.project?.customerId || "unknown";
    clientsByPayments[cid] = (clientsByPayments[cid] || 0) + 1;
  }
  const clientCounts = Object.values(clientsByPayments);
  const repeatClientsCount = clientCounts.filter((c) => c > 1).length;
  const uniqueClientsCount = clientCounts.length || 1;
  const repeatClientsPercent = (repeatClientsCount / uniqueClientsCount) * 100;

  // 10. Prepare payload
  const payload = {
    earningsData: {
      totalEarnings: Number(totalEarnings.toFixed(2)),
      thisMonth: Number(thisMonth.toFixed(2)),
      monthlyGrowth: Number(monthlyGrowth.toFixed(2)),
      pendingPayments: Number(pendingPayments.toFixed(2)),
      availableBalance: Number(availableBalance.toFixed(2)),
      averageProjectValue: Number(averageProjectValue.toFixed(2)),
    },
    recentPayments,
    monthlyEarnings,
    topClients,
    quickStats: {
      projectsThisMonth,
      successRate: Number(successRate.toFixed(2)),
      repeatClientsPercent: Number(repeatClientsPercent.toFixed(2)),
    },
  };

  // Optionally apply timeFilter to monthlyEarnings or other arrays if needed (UI picks filter)
  // The UI is handling timeFilter; we still accept it if you want the backend to filter.
  // For now we return the full package and the UI can decide what to display.

  return payload;
}




export const getPaymentDetailsService = async (paymentId) => {
  if (!paymentId) {
    const error = new Error("paymentId is required");
    error.status = 400;
    throw error;
  }

  // validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(paymentId)) {
    const error = new Error("Invalid paymentId UUID");
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


// Fetch all payout methods for a provider
export async function getPayoutMethods(providerProfileId) {
  return prisma.payoutMethod.findMany({
    where: { providerProfileId },
    orderBy: { createdAt: "desc" },
  });
}

// Create a new payout method
export async function createPayoutMethod(providerProfileId, data) {
  return prisma.payoutMethod.create({
    data: {
      providerProfileId,
      type: data.type,
      label: data.label,
      bankName: data.bankName,
      accountNumber: data.accountNumber,
      accountHolder: data.accountHolder,
      accountEmail: data.accountEmail,
      walletId: data.walletId,
    },
  });
}

// Update an existing payout method
export async function updatePayoutMethod(id, data) {
  return prisma.payoutMethod.update({
    where: { id },
    data: {
      type: data.type,
      label: data.label,
      bankName: data.bankName,
      accountNumber: data.accountNumber,
      accountHolder: data.accountHolder,
      accountEmail: data.accountEmail,
      walletId: data.walletId,
    },
  });
}

// Delete a payout method
export async function deletePayoutMethod(id) {
  return prisma.payoutMethod.delete({
    where: { id },
  });
}

// Fetch single payout method by ID
export async function getPayoutMethodById(id) {
  return prisma.payoutMethod.findUnique({
    where: { id },
  });
}