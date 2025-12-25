import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const dashboardModel = {
  async getDashboardStats() {
    // Get all stats in parallel
    const [
      totalUsers,
      activeUsers,
      providers,
      customers,
      totalProjects,
      activeProjects,
      completedProjects,
      disputedProjects,
      openDisputes,
      underReviewDisputes,
      pendingVerifications,
      totalRevenue,
    ] = await Promise.all([
      // Users
      prisma.user.count(),
      prisma.user.count({ where: { status: "ACTIVE" } }),
      prisma.user.count({ where: { role: { has: "PROVIDER" } } }),
      prisma.user.count({ where: { role: { has: "CUSTOMER" } } }),
      
      // Projects
      prisma.project.count(),
      prisma.project.count({ where: { status: "IN_PROGRESS" } }),
      prisma.project.count({ where: { status: "COMPLETED" } }),
      prisma.project.count({ where: { status: "DISPUTED" } }),
      
      // Disputes
      prisma.dispute.count({ where: { status: "OPEN" } }),
      prisma.dispute.count({ where: { status: "UNDER_REVIEW" } }),
      
      // Pending verifications (users with pending_verification status AND uploaded documents)
      prisma.user.count({ 
        where: { 
          kycStatus: "pending_verification",
          KycDocument: {
            some: {
              status: "uploaded",
            },
          },
        },
      }),
      
      // Total revenue (sum of all released payments)
      prisma.payment.aggregate({
        where: { status: "RELEASED" },
        _sum: { amount: true },
      }),
    ]);

    // Calculate growth rate (compare last 30 days vs previous 30 days)
    const now = new Date();
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const previous30Days = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const [currentPeriodUsers, previousPeriodUsers] = await Promise.all([
      prisma.user.count({
        where: {
          createdAt: { gte: last30Days },
        },
      }),
      prisma.user.count({
        where: {
          createdAt: {
            gte: previous30Days,
            lt: last30Days,
          },
        },
      }),
    ]);

    const platformGrowth = previousPeriodUsers > 0
      ? ((currentPeriodUsers - previousPeriodUsers) / previousPeriodUsers) * 100
      : currentPeriodUsers > 0 ? 100 : 0;

    return {
      totalUsers,
      activeUsers,
      providers,
      customers,
      totalProjects,
      activeProjects,
      completedProjects,
      disputedProjects,
      openDisputes,
      underReviewDisputes,
      pendingVerifications,
      totalRevenue: totalRevenue._sum.amount || 0,
      platformGrowth: Math.round(platformGrowth * 10) / 10, // Round to 1 decimal
    };
  },

  async getRecentActivity(limit = 10) {
    // Get recent user registrations
    const recentUsers = await prisma.user.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        providerProfile: {
          select: {
            profileImageUrl: true,
          },
        },
        customerProfile: {
          select: {
            profileImageUrl: true,
          },
        },
      },
    });

    // Get recent project completions
    const recentCompletedProjects = await prisma.project.findMany({
      where: { status: "COMPLETED" },
      take: limit,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        customer: {
          select: {
            id: true,
            name: true,
          },
        },
        updatedAt: true,
      },
    });

    // Get recent disputes
    const recentDisputes = await prisma.dispute.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        reason: true,
        status: true,
        raisedBy: {
          select: {
            id: true,
            name: true,
          },
        },
        project: {
          select: {
            id: true,
            title: true,
          },
        },
        createdAt: true,
      },
    });

    // Get recent payments
    const recentPayments = await prisma.payment.findMany({
      where: { status: "RELEASED" },
      take: limit,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        amount: true,
        project: {
          select: {
            id: true,
            title: true,
            customer: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        milestone: {
          select: {
            id: true,
            title: true,
          },
        },
        updatedAt: true,
      },
    });

    // Combine and format activities
    const activities = [];

    // Add user registrations
    recentUsers.forEach((user) => {
      const isProvider = user.role?.includes("PROVIDER");
      const profile = isProvider ? user.providerProfile : user.customerProfile;
      activities.push({
        id: `user-${user.id}`,
        type: "user_registration",
        user: user.name,
        action: `New ${isProvider ? "provider" : "customer"} registration`,
        time: user.createdAt,
        status: "pending",
        avatar: profile?.profileImageUrl || null,
      });
    });

    // Add project completions
    recentCompletedProjects.forEach((project) => {
      activities.push({
        id: `project-${project.id}`,
        type: "project_completion",
        user: project.customer?.name || "Unknown",
        action: `Project completed - ${project.title}`,
        time: project.updatedAt,
        status: "completed",
        projectId: project.id,
      });
    });

    // Add disputes
    recentDisputes.forEach((dispute) => {
      activities.push({
        id: `dispute-${dispute.id}`,
        type: "dispute",
        user: dispute.raisedBy?.name || "Unknown",
        action: `Dispute raised for ${dispute.project?.title || "project"}`,
        time: dispute.createdAt,
        status: dispute.status === "OPEN" ? "urgent" : "pending",
        disputeId: dispute.id,
        projectId: dispute.project?.id,
      });
    });

    // Add payments
    recentPayments.forEach((payment) => {
      activities.push({
        id: `payment-${payment.id}`,
        type: "payment",
        user: payment.project?.customer?.name || "Unknown",
        action: `Payment released - RM ${payment.amount.toLocaleString()}`,
        time: payment.updatedAt,
        status: "completed",
        projectId: payment.project?.id,
      });
    });

    // Sort by time (most recent first) and limit
    activities.sort((a, b) => new Date(b.time) - new Date(a.time));
    return activities.slice(0, limit);
  },

  async getPendingVerifications(limit = 5) {
    const users = await prisma.user.findMany({
      where: { 
        kycStatus: "pending_verification",
        KycDocument: {
          some: {
            status: "uploaded",
          },
        },
      },
      take: limit,
      orderBy: { createdAt: "asc" }, // Oldest first
      include: {
        KycDocument: {
          where: { status: "uploaded" },
          select: {
            id: true,
            type: true,
            filename: true,
            uploadedAt: true,
          },
          orderBy: { uploadedAt: "desc" },
        },
        providerProfile: {
          select: {
            profileImageUrl: true,
          },
        },
        customerProfile: {
          select: {
            profileImageUrl: true,
          },
        },
      },
    });

    return users
      .filter((user) => user.KycDocument && user.KycDocument.length > 0)
      .map((user) => {
        const isProvider = user.role?.includes("PROVIDER");
        const profile = isProvider ? user.providerProfile : user.customerProfile;
        const documents = user.KycDocument.map((doc) => {
          switch (doc.type) {
            case "PROVIDER_ID":
              return "ID Document";
            case "COMPANY_REG":
              return "Company Registration";
            case "COMPANY_DIRECTOR_ID":
              return "Director ID";
            default:
              return doc.filename;
          }
        });

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          type: isProvider ? "Provider" : "Customer",
          submitted: user.KycDocument[0]?.uploadedAt || user.createdAt,
          documents,
          documentCount: user.KycDocument.length,
          avatar: profile?.profileImageUrl || null,
        };
      });
  },

  async getTopProviders(limit = 5) {
    const providers = await prisma.user.findMany({
      where: {
        role: { has: "PROVIDER" },
        status: "ACTIVE",
      },
      take: limit,
      orderBy: {
        providerProfile: {
          rating: "desc",
        },
      },
      include: {
        providerProfile: {
          select: {
            rating: true,
            totalProjects: true,
            totalEarnings: true,
            profileImageUrl: true,
          },
        },
      },
    });

    return providers
      .filter((p) => p.providerProfile)
      .map((provider) => ({
        id: provider.id,
        name: provider.name,
        rating: parseFloat(provider.providerProfile?.rating || 0),
        completedJobs: provider.providerProfile?.totalProjects || 0,
        earnings: parseFloat(provider.providerProfile?.totalEarnings || 0),
        avatar: provider.providerProfile?.profileImageUrl || null,
      }))
      .sort((a, b) => b.rating - a.rating || b.earnings - a.earnings)
      .slice(0, limit);
  },
};

export default prisma;