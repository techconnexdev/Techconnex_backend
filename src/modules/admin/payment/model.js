
import { convertWithSnapshot, normalizeCurrencyCode } from "../../fx/service.js";
import { prisma } from "../../../utils/prisma.js";
function toMyrAmount(value, paymentCurrency, projectCurrency, ratesMap) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return 0;
  const fromCurrency =
    normalizeCurrencyCode(paymentCurrency) ||
    normalizeCurrencyCode(projectCurrency) ||
    "MYR";
  if (fromCurrency === "MYR") return amount;
  const converted = convertWithSnapshot({
    amount,
    fromCurrencyCode: fromCurrency,
    toCurrencyCode: "MYR",
    ratesMap: ratesMap || null,
  });
  // If conversion snapshot is unavailable for a legacy row, keep original numeric value.
  return converted == null ? amount : converted;
}

export const paymentModel = {
  /**
   * Get all payments with filters and pagination
   */
  async getAllPayments(filters = {}) {
    const {
      search,
      status,
      method,
      dateFrom,
      dateTo,
      participant,
      transfer,
      page = 1,
      limit = 50,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = filters;

    const skip = (page - 1) * limit;

    const andConditions = [];

    if (dateFrom || dateTo) {
      const createdAt = {};
      if (dateFrom) {
        const d = new Date(String(dateFrom));
        d.setHours(0, 0, 0, 0);
        createdAt.gte = d;
      }
      if (dateTo) {
        const d = new Date(String(dateTo));
        d.setHours(23, 59, 59, 999);
        createdAt.lte = d;
      }
      andConditions.push({ createdAt });
    }

    if (status && status !== "all") {
      andConditions.push({ status });
    }

    if (method && method !== "all") {
      andConditions.push({ method });
    }

    const transferMode = typeof transfer === "string" ? transfer.trim() : "";
    if (transferMode === "ready-to-transfer") {
      andConditions.push({
        status: "ESCROWED",
        milestone: { status: "APPROVED" },
      });
    } else if (transferMode === "normal") {
      andConditions.push({
        NOT: {
          AND: [
            { status: "ESCROWED" },
            { milestone: { status: "APPROVED" } },
          ],
        },
      });
    }

    if (search && String(search).trim()) {
      const q = String(search).trim();
      andConditions.push({
        OR: [
          {
            project: {
              title: {
                contains: q,
                mode: "insensitive",
              },
            },
          },
          {
            project: {
              customer: {
                name: {
                  contains: q,
                  mode: "insensitive",
                },
              },
            },
          },
          {
            project: {
              customer: {
                email: {
                  contains: q,
                  mode: "insensitive",
                },
              },
            },
          },
          {
            project: {
              provider: {
                name: {
                  contains: q,
                  mode: "insensitive",
                },
              },
            },
          },
          {
            project: {
              provider: {
                email: {
                  contains: q,
                  mode: "insensitive",
                },
              },
            },
          },
          {
            milestone: {
              title: {
                contains: q,
                mode: "insensitive",
              },
            },
          },
        ],
      });
    }

    if (participant && String(participant).trim()) {
      const q = String(participant).trim();
      andConditions.push({
        OR: [
          {
            project: {
              customer: {
                name: {
                  contains: q,
                  mode: "insensitive",
                },
              },
            },
          },
          {
            project: {
              customer: {
                email: {
                  contains: q,
                  mode: "insensitive",
                },
              },
            },
          },
          {
            project: {
              provider: {
                name: {
                  contains: q,
                  mode: "insensitive",
                },
              },
            },
          },
          {
            project: {
              provider: {
                email: {
                  contains: q,
                  mode: "insensitive",
                },
              },
            },
          },
        ],
      });
    }

    const where =
      andConditions.length > 0 ? { AND: andConditions } : {};

    // Build orderBy
    const orderBy = {};
    if (sortBy === "amount") {
      orderBy.amount = sortOrder;
    } else if (sortBy === "status") {
      orderBy.status = sortOrder;
    } else if (sortBy === "createdAt") {
      orderBy.createdAt = sortOrder;
    } else {
      orderBy.createdAt = "desc";
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          project: {
            include: {
              customer: {
                include: {
                  customerProfile: true,
                },
              },
              provider: {
                include: {
                  providerProfile: {
                    include: {
                      payoutMethods: true,
                    },
                  },
                },
              },
            },
          },
          milestone: true,
          Invoice: true,
        },
        skip,
        take: limit,
        orderBy,
      }),
      prisma.payment.count({ where }),
    ]);

    return {
      payments,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  },

  /**
   * Get payment by ID with all related data
   */
  async getPaymentById(paymentId) {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        project: {
          include: {
            customer: {
              include: {
                customerProfile: true,
                settings: true,
              },
            },
            provider: {
              include: {
                providerProfile: {
                  include: {
                    payoutMethods: true,
                  },
                },
                settings: true,
              },
            },
            milestones: {
              orderBy: { order: "asc" },
            },
          },
        },
        milestone: true,
        Invoice: true,
        Dispute: {
          include: {
            raisedBy: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    return payment;
  },

  /**
   * Get payments ready for transfer (ESCROWED + APPROVED milestone)
   */
  async getReadyToTransferPayments() {
    return await prisma.payment.findMany({
      where: {
        status: "ESCROWED",
        milestone: {
          status: "APPROVED",
        },
      },
      include: {
        project: {
          include: {
            provider: {
              include: {
                providerProfile: {
                  include: {
                    payoutMethods: true,
                  },
                },
              },
            },
          },
        },
        milestone: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });
  },

  /**
   * Get payment statistics
   */
  async getPaymentStats() {
    const [
      totalPayments,
      paymentsForTotals,
      pendingPayments,
      escrowedPayments,
      releasedPayments,
      transferredPayments,
      failedPayments,
      readyToTransfer,
    ] = await Promise.all([
      prisma.payment.count(),
      prisma.payment.findMany({
        select: {
          status: true,
          amount: true,
          platformFeeAmount: true,
          currency: true,
          milestone: {
            select: {
              amount: true,
            },
          },
          project: {
            select: {
              currencyCode: true,
              fxSnapshotRatesJson: true,
            },
          },
        },
      }),
      prisma.payment.count({
        where: { status: "PENDING" },
      }),
      prisma.payment.count({
        where: { status: "ESCROWED" },
      }),
      prisma.payment.count({
        where: { status: "RELEASED" },
      }),
      prisma.payment.count({
        where: { status: "TRANSFERRED" },
      }),
      prisma.payment.count({
        where: { status: "FAILED" },
      }),
      prisma.payment.count({
        where: {
          status: "ESCROWED",
          milestone: {
            status: "APPROVED",
          },
        },
      }),
    ]);

    const { totalVolume, totalFees, netWorth } = paymentsForTotals.reduce(
      (acc, p) => {
        const ratesMap = p.project?.fxSnapshotRatesJson || null;
        const projectCurrency = p.project?.currencyCode || "MYR";
        const paymentCurrency = p.currency || projectCurrency;
        const status = String(p.status || "").toUpperCase();
        const milestoneAmount = Number(p.milestone?.amount || 0);
        const escrowHeldAmount =
          milestoneAmount > 0
            ? Number((milestoneAmount * 1.05).toFixed(2))
            : Number(p.amount || 0);
        const transferredFeeOnly =
          milestoneAmount > 0
            ? Number((milestoneAmount * 0.1).toFixed(2))
            : Number(p.platformFeeAmount || 0);

        acc.totalVolume += toMyrAmount(
          p.amount,
          paymentCurrency,
          projectCurrency,
          ratesMap,
        );
        acc.totalFees += toMyrAmount(
          p.platformFeeAmount,
          paymentCurrency,
          projectCurrency,
          ratesMap,
        );
        // Net worth rule:
        // - For ESCROWED and TRANSFERRED, count only fee value.
        if (status === "ESCROWED" || status === "TRANSFERRED") {
          acc.netWorth += toMyrAmount(
            transferredFeeOnly,
            paymentCurrency,
            projectCurrency,
            ratesMap,
          );
        }
        return acc;
      },
      { totalVolume: 0, totalFees: 0, netWorth: 0 },
    );

    return {
      totalPayments,
      totalVolume: Number(totalVolume.toFixed(2)),
      totalFees: Number(totalFees.toFixed(2)),
      netWorth: Number(netWorth.toFixed(2)),
      pendingPayments,
      escrowedPayments,
      releasedPayments,
      transferredPayments,
      failedPayments,
      readyToTransfer,
    };
  },

  /**
   * Get revenue statistics (total revenue from TRANSFERRED payments and growth rate)
   */
  async getRevenueStats() {
    try {
      // Get total revenue (MYR-normalized): sum of platform fee for TRANSFERRED payments
      const transferredPayments = await prisma.payment.findMany({
        where: { status: "TRANSFERRED" },
        select: {
          platformFeeAmount: true,
          currency: true,
          project: {
            select: {
              currencyCode: true,
              fxSnapshotRatesJson: true,
            },
          },
        },
      });
      const totalRevenue = transferredPayments.reduce((sum, p) => {
        const ratesMap = p.project?.fxSnapshotRatesJson || null;
        const projectCurrency = p.project?.currencyCode || "MYR";
        const paymentCurrency = p.currency || projectCurrency;
        return (
          sum +
          toMyrAmount(
            p.platformFeeAmount,
            paymentCurrency,
            projectCurrency,
            ratesMap,
          )
        );
      }, 0);

      // Calculate growth rate (compare last 30 days vs previous 30 days)
      const now = new Date();
      const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const previous30DaysStart = new Date(
        now.getTime() - 60 * 24 * 60 * 60 * 1000
      );
      const previous30DaysEnd = last30Days;

      // Get revenue for current period (last 30 days)
      // Use bankTransferDate if available, otherwise use updatedAt (when bankTransferDate is null)
      const currentPeriodPayments = await prisma.payment.findMany({
        where: {
          status: "TRANSFERRED",
          OR: [
            {
              bankTransferDate: {
                gte: last30Days,
              },
            },
            {
              AND: [
                { bankTransferDate: null },
                {
                  updatedAt: {
                    gte: last30Days,
                  },
                },
              ],
            },
          ],
        },
        select: {
          platformFeeAmount: true,
          currency: true,
          project: {
            select: {
              currencyCode: true,
              fxSnapshotRatesJson: true,
            },
          },
        },
      });

      // Get revenue for previous period (30-60 days ago)
      const previousPeriodPayments = await prisma.payment.findMany({
        where: {
          status: "TRANSFERRED",
          OR: [
            {
              bankTransferDate: {
                gte: previous30DaysStart,
                lt: previous30DaysEnd,
              },
            },
            {
              AND: [
                { bankTransferDate: null },
                {
                  updatedAt: {
                    gte: previous30DaysStart,
                    lt: previous30DaysEnd,
                  },
                },
              ],
            },
          ],
        },
        select: {
          platformFeeAmount: true,
          currency: true,
          project: {
            select: {
              currencyCode: true,
              fxSnapshotRatesJson: true,
            },
          },
        },
      });

      const currentRevenue = currentPeriodPayments.reduce((sum, p) => {
        const ratesMap = p.project?.fxSnapshotRatesJson || null;
        const projectCurrency = p.project?.currencyCode || "MYR";
        const paymentCurrency = p.currency || projectCurrency;
        return (
          sum +
          toMyrAmount(
            p.platformFeeAmount,
            paymentCurrency,
            projectCurrency,
            ratesMap,
          )
        );
      }, 0);
      const previousRevenue = previousPeriodPayments.reduce((sum, p) => {
        const ratesMap = p.project?.fxSnapshotRatesJson || null;
        const projectCurrency = p.project?.currencyCode || "MYR";
        const paymentCurrency = p.currency || projectCurrency;
        return (
          sum +
          toMyrAmount(
            p.platformFeeAmount,
            paymentCurrency,
            projectCurrency,
            ratesMap,
          )
        );
      }, 0);

      // Calculate growth rate
      const growthRate =
        previousRevenue > 0
          ? ((currentRevenue - previousRevenue) / previousRevenue) * 100
          : currentRevenue > 0
          ? 100
          : 0;

      return {
        totalRevenue: Number(totalRevenue.toFixed(2)),
        growthRate: Math.round(growthRate * 10) / 10, // Round to 1 decimal place
      };
    } catch (error) {
      console.error("Error in getRevenueStats:", error);
      throw error;
    }
  },
};

export default prisma;
