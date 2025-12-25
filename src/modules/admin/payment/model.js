import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const paymentModel = {
  /**
   * Get all payments with filters and pagination
   */
  async getAllPayments(filters = {}) {
    const {
      search,
      status,
      method,
      page = 1,
      limit = 50,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = filters;

    const skip = (page - 1) * limit;

    // Build where clause
    const where = {};

    if (status && status !== "all") {
      where.status = status;
    }

    if (method && method !== "all") {
      where.method = method;
    }

    if (search) {
      where.OR = [
        {
          project: {
            title: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
        {
          project: {
            customer: {
              name: {
                contains: search,
                mode: "insensitive",
              },
            },
          },
        },
        {
          project: {
            provider: {
              name: {
                contains: search,
                mode: "insensitive",
              },
            },
          },
        },
        {
          milestone: {
            title: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
      ];
    }

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
      totalVolume,
      totalFees,
      pendingPayments,
      escrowedPayments,
      releasedPayments,
      transferredPayments,
      failedPayments,
      readyToTransfer,
    ] = await Promise.all([
      prisma.payment.count(),
      prisma.payment.aggregate({
        _sum: { amount: true },
      }),
      prisma.payment.aggregate({
        _sum: { platformFeeAmount: true },
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

    return {
      totalPayments,
      totalVolume: totalVolume._sum.amount || 0,
      totalFees: totalFees._sum.platformFeeAmount || 0,
      pendingPayments,
      escrowedPayments,
      releasedPayments,
      transferredPayments,
      failedPayments,
      readyToTransfer,
    };
  },
};

export default prisma;
