import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const disputeModel = {
  async getAllDisputes(filters = {}) {
    const where = {};

    if (filters.status && filters.status !== "all") {
      where.status = filters.status.toUpperCase();
    }

    // Search functionality
    if (filters.search) {
      where.OR = [
        { reason: { contains: filters.search, mode: "insensitive" } },
        { description: { contains: filters.search, mode: "insensitive" } },
        {
          project: {
            title: { contains: filters.search, mode: "insensitive" },
          },
        },
        {
          project: {
            customer: {
              name: { contains: filters.search, mode: "insensitive" },
            },
          },
        },
        {
          project: {
            provider: {
              name: { contains: filters.search, mode: "insensitive" },
            },
          },
        },
        {
          raisedBy: {
            name: { contains: filters.search, mode: "insensitive" },
          },
        },
      ];
    }

    const disputes = await prisma.dispute.findMany({
      where,
      include: {
        payment: {
          include: {
            milestone: {
              include: {
                project: {
                  include: {
                    customer: {
                      select: {
                        id: true,
                        name: true,
                        email: true,
                        customerProfile: {
                          select: {
                            companySize: true,
                            industry: true,
                          },
                        },
                      },
                    },
                    provider: {
                      select: {
                        id: true,
                        name: true,
                        email: true,
                        providerProfile: {
                          select: {
                            location: true,
                            rating: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        project: {
          include: {
            customer: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            provider: {
              select: {
                id: true,
                name: true,
                email: true,
                providerProfile: {
                  include: {
                    payoutMethods: {
                      orderBy: {
                        createdAt: "desc",
                      },
                    },
                  },
                },
              },
            },
            milestones: {
              take: 1,
            },
          },
        },
        milestone: {
          select: {
            id: true,
            title: true,
            amount: true,
            status: true,
          },
        },
        raisedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return disputes;
  },

  async getDisputeById(disputeId) {
    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        payment: {
          include: {
            milestone: {
              include: {
                project: {
                  include: {
                    customer: {
                      select: {
                        id: true,
                        name: true,
                        email: true,
                      },
                    },
                    provider: {
                      select: {
                        id: true,
                        name: true,
                        email: true,
                        providerProfile: {
                          include: {
                            payoutMethods: {
                              orderBy: {
                                createdAt: "desc",
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        project: {
          include: {
            customer: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            provider: {
              select: {
                id: true,
                name: true,
                email: true,
                providerProfile: {
                  include: {
                    payoutMethods: {
                      orderBy: {
                        createdAt: "desc",
                      },
                    },
                  },
                },
              },
            },
            milestones: {
              orderBy: {
                order: "asc",
              },
            },
          },
        },
        milestone: {
          select: {
            id: true,
            title: true,
            amount: true,
            status: true,
          },
        },
        raisedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return dispute;
  },

  async updateDisputeStatus(disputeId, status, resolution = null, adminId = null, adminName = null) {
    // Get existing dispute to access current resolutionNotes
    const existingDispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
      select: { resolutionNotes: true },
    });

    // Parse existing resolution notes or initialize empty array
    let resolutionNotes = [];
    if (existingDispute?.resolutionNotes) {
      try {
        resolutionNotes = Array.isArray(existingDispute.resolutionNotes) 
          ? existingDispute.resolutionNotes 
          : JSON.parse(existingDispute.resolutionNotes || "[]");
      } catch (e) {
        resolutionNotes = [];
      }
    }

    // If resolution note is provided, add it to the array
    if (resolution && resolution.trim()) {
      resolutionNotes.push({
        note: resolution.trim(),
        createdAt: new Date().toISOString(),
        adminId: adminId || null,
        adminName: adminName || "Admin",
      });
    }

    const dispute = await prisma.dispute.update({
      where: { id: disputeId },
      data: {
        status: status.toUpperCase(),
        resolution: resolution || undefined, // Keep legacy field for backward compatibility
        resolutionNotes: resolutionNotes.length > 0 ? resolutionNotes : undefined,
        updatedAt: new Date(),
      },
      include: {
        payment: {
          include: {
            milestone: true,
          },
        },
        project: true,
      },
    });

    return dispute;
  },

  async getDisputeStats() {
    const [total, open, underReview, resolved, closed] = await Promise.all([
      prisma.dispute.count(),
      prisma.dispute.count({ where: { status: "OPEN" } }),
      prisma.dispute.count({ where: { status: "UNDER_REVIEW" } }),
      prisma.dispute.count({ where: { status: "RESOLVED" } }),
      prisma.dispute.count({ where: { status: "CLOSED" } }),
    ]);

    const disputes = await prisma.dispute.findMany({
      include: {
        payment: {
          select: {
            amount: true,
          },
        },
        milestone: true, // Include full milestone object
      },
    });

    const totalAmount = disputes.reduce((sum, d) => {
      const milestoneAmount = d.milestone?.amount || 0;
      return sum + (d.payment?.amount || d.contestedAmount || milestoneAmount || 0);
    }, 0);

    return {
      totalDisputes: total,
      openDisputes: open,
      inReviewDisputes: underReview,
      resolvedDisputes: resolved,
      closedDisputes: closed,
      totalAmount,
    };
  },
};

export default prisma;

