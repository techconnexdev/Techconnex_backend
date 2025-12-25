// src/modules/company/billing/model.js
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function getTotalSpent(userId) {
  return prisma.payment.aggregate({
    _sum: { amount: true },
    where: {
      status: { in: ["ESCROWED", "RELEASED", "TRANSFERRED"] },
      project: { customerId: userId },
    },
  });
}

async function getPendingPayments(userId) {
  return prisma.payment.aggregate({
    _sum: { amount: true },
    where: { status: "PENDING", project: { customerId: userId } },
  });
}

async function getThisMonthSpent(userId, firstDay, lastDay) {
  return prisma.payment.aggregate({
    _sum: { amount: true },
    where: {
      status: { in: ["ESCROWED", "RELEASED", "TRANSFERRED"] },
      project: { customerId: userId },
      createdAt: { gte: firstDay, lte: lastDay },
    },
  });
}

async function getAverageTransaction(userId) {
  return prisma.payment.aggregate({
    _avg: { amount: true },
    where: {
      status: { in: ["ESCROWED", "RELEASED", "TRANSFERRED"] },
      project: { customerId: userId },
    },
  });
}

async function getRecentInvoices(userId, limit = 5) {
  return prisma.invoice.findMany({
    where: { customerId: userId },
    orderBy: { issueDate: "desc" },
    take: limit,
    include: { provider: true, project: true },
  });
}

async function getRecentTransactions(userId, limit = 5) {
  return prisma.payment.findMany({
    where: {
      status: { in: ["ESCROWED", "RELEASED", "TRANSFERRED"] },
      project: { customerId: userId },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      project: { select: { title: true, category: true } },
      milestone: { select: { title: true } },
      Invoice: { select: { invoiceNumber: true } },
    },
  });
}

async function getAllTransactions(userId) {
  return prisma.payment.findMany({
    where: {
      status: { in: ["ESCROWED", "RELEASED", "TRANSFERRED"] },
      project: { customerId: userId },
    },
    orderBy: { createdAt: "desc" },
    include: {
      project: { select: { title: true, category: true } },
      milestone: { select: { title: true } },
      Invoice: { select: { invoiceNumber: true } },
    },
  });
}

async function getAllInvoices(userId) {
  return prisma.invoice.findMany({
    where: { customerId: userId },
    orderBy: { issueDate: "desc" },
    include: { provider: true, project: true },
  });
}
export const findUpcomingPayments = async (userId, currentDate) => {
  if (!userId) throw new Error("User ID is missing");

  return prisma.project.findMany({
    where: {
      status: "IN_PROGRESS", // 🔥 Only live projects
      OR: [{ customerId: userId }, { providerId: userId }],
      milestones: {
        some: {
          status: "LOCKED", // 🔥 Only locked milestones
        },
      },
    },
    select: {
      id: true,
      title: true,
      status: true,
      milestones: {
        where: {
          status: "LOCKED", // 🔥 Filter milestones directly
        },
        select: {
          id: true,
          title: true,
          status: true,
          dueDate: true,
          amount: true,
        },
      },
    },
  });
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

export {
  getTotalSpent,
  getPendingPayments,
  getThisMonthSpent,
  getAverageTransaction,
  getRecentInvoices,
  getRecentTransactions,
  getAllTransactions,
  getAllInvoices,
};
