// model.js
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Get provider earnings summary
 */
export const getProviderEarningsSummary = async (providerId) => {
  const completedPayments = await prisma.payment.findMany({
    where: {
      project: { providerId },
      status: "RELEASED",
    },
    select: { amount: true },
  });

  const profile = await prisma.providerProfile.findUnique({
    where: { id: providerId },
  });

  const pendingPayments = await prisma.payment.findMany({
    where: {
      project: { providerId },
      status: { in: ["ESCROWED", "PENDING", "IN_PROGRESS"] },
    },
    select: { amount: true },
  });

  const totalEarnings = completedPayments.reduce((sum, p) => sum + p.amount, 0);
  const pending = pendingPayments.reduce((sum, p) => sum + p.amount, 0);
  const availableBalance = -(totalEarnings - pending); // can adjust if escrowed logic applies

  return {
    totalEarnings,
    pendingPayments: pending,
    availableBalance,
    profile
  };
};

/**
 * Get recent payments for provider
 */
export const getRecentPayments = async (providerId) => {
  return await prisma.payment.findMany({
    where: { project: { providerId } },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: {
      project: {
        include: {
          customer: true,
        },
      },
      milestone: true,
    },
  });
};

/**
 * Get monthly earnings trend
 */
export const getMonthlyEarnings = async (providerId) => {
  const payments = await prisma.payment.findMany({
    where: {
      project: { providerId },
      status: "RELEASED",
    },
    select: { amount: true, createdAt: true },
  });

  // Group by month
  const monthly = {};
  for (const p of payments) {
    const key = new Date(p.createdAt).toLocaleString("en-US", {
      month: "short",
      year: "numeric",
    });
    monthly[key] = (monthly[key] || 0) + p.amount;
  }

  return Object.entries(monthly).map(([month, amount]) => ({
    month,
    amount,
  }));
};

/**
 * Get top clients for provider
 */
export const getTopClients = async (providerId) => {
  const clients = await prisma.payment.groupBy({
    by: ["projectId"],
    _sum: { amount: true },
    where: {
      project: { providerId },
      status: "RELEASED",
    },
  });

  // Get client names
  const projects = await prisma.project.findMany({
    where: {
      id: { in: clients.map((c) => c.projectId) },
    },
    include: { customer: true },
  });

  return projects.map((p) => ({
    name: p.customer.name,
    totalPaid: clients.find((c) => c.projectId === p.id)?._sum.amount || 0,
    projects: 1, // could aggregate if multiple
  }));
};

export const findPaymentWithFullDetails = async (paymentId) => {
  return prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      // Basic payment relations
      Invoice: true,
      Dispute: true,
      Settings: true,

      // Milestone
      milestone: {
        include: {
          Proposal: true, // if you want the proposal
          // you can include payment history, disputes, etc. if relation exists
        },
      },

      // Project + nested Customer and Provider
      project: {
        include: {
          // Basic project fields are included by default in returned project object

          // Customer: include base user fields + customer profile
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              isVerified: true,
              createdAt: true,
              // profile relations
              customerProfile: {
                select: {
                  id: true,
                  description: true,
                  industry: true,
                  location: true,
                  website: true,
                  profileImageUrl: true,
                  socialLinks: true,
                  languages: true,
                  companySize: true,
                  employeeCount: true,
                  establishedYear: true,
                  annualRevenue: true,
                  fundingStage: true,
                  preferredContractTypes: true,
                  averageBudgetRange: true,
                  remotePolicy: true,
                  hiringFrequency: true,
                  categoriesHiringFor: true,
                  completion: true,
                  rating: true,
                  reviewCount: true,
                  totalSpend: true,
                  projectsPosted: true,
                  lastActiveAt: true,
                  mission: true,
                  values: true,
                  benefits: true,
                  mediaGallery: true,
                  createdAt: true,
                  updatedAt: true,
                },
              },
            },
          },

          // Provider: include base user fields + full provider profile & nested relations
          provider: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              isVerified: true,
              createdAt: true,
              providerProfile: {
                select: {
                  id: true,
                  bio: true,
                  location: true,
                  hourlyRate: true,
                  availability: true,
                  languages: true,
                  website: true,
                  profileImageUrl: true,
                  rating: true,
                  totalReviews: true,
                  totalProjects: true,
                  totalEarnings: true,
                  viewsCount: true,
                  successRate: true,
                  responseTime: true,
                  isFeatured: true,
                  completion: true,
                  skills: true,
                  yearsExperience: true,
                  minimumProjectBudget: true,
                  maximumProjectBudget: true,
                  preferredProjectDuration: true,
                  workPreference: true,
                  teamSize: true,
                  createdAt: true,
                  updatedAt: true,
                  // nested relations
                  certifications: true,
                  portfolios: true,
                  performance: true,
                },
              },
            },
          },

          // If you want other project relations:
          // invoices, messages, reviews, etc. add includes here
        },
      },
    },
  });
};