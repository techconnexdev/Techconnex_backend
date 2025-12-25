import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Helper function to calculate date range
function getDateRange(dateRange) {
  const now = new Date();
  let startDate;

  switch (dateRange) {
    case "last_7_days":
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "last_30_days":
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case "last_3_months":
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case "last_6_months":
      startDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
      break;
    case "last_year":
      startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      break;
    default:
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // Default to 30 days
  }

  return { startDate, endDate: now };
}

// Helper to get previous period for comparison
function getPreviousPeriod(startDate, endDate) {
  const duration = endDate.getTime() - startDate.getTime();
  return {
    startDate: new Date(startDate.getTime() - duration),
    endDate: startDate,
  };
}

export const reportsModel = {
  async getOverviewStats(dateRange = "last_30_days", customStartDate = null, customEndDate = null) {
    const { startDate, endDate } = customStartDate && customEndDate
      ? { startDate: new Date(customStartDate), endDate: new Date(customEndDate) }
      : getDateRange(dateRange);

    const previousPeriod = getPreviousPeriod(startDate, endDate);

    // Total Revenue (from completed milestone payments)
    const currentRevenue = await prisma.payment.aggregate({
      where: {
        status: "RELEASED",
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      _sum: {
        amount: true,
      },
    });

    const previousRevenue = await prisma.payment.aggregate({
      where: {
        status: "RELEASED",
        createdAt: {
          gte: previousPeriod.startDate,
          lte: previousPeriod.endDate,
        },
      },
      _sum: {
        amount: true,
      },
    });

    const totalRevenue = currentRevenue._sum.amount || 0;
    const prevTotalRevenue = previousRevenue._sum.amount || 0;
    const revenueGrowth = prevTotalRevenue > 0
      ? ((totalRevenue - prevTotalRevenue) / prevTotalRevenue) * 100
      : totalRevenue > 0 ? 100 : 0;

    // Total Users
    const currentUsers = await prisma.user.count({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const previousUsers = await prisma.user.count({
      where: {
        createdAt: {
          gte: previousPeriod.startDate,
          lte: previousPeriod.endDate,
        },
      },
    });

    const userGrowth = previousUsers > 0
      ? ((currentUsers - previousUsers) / previousUsers) * 100
      : currentUsers > 0 ? 100 : 0;

    // Total Projects
    const currentProjects = await prisma.project.count({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const previousProjects = await prisma.project.count({
      where: {
        createdAt: {
          gte: previousPeriod.startDate,
          lte: previousPeriod.endDate,
        },
      },
    });

    const projectGrowth = previousProjects > 0
      ? ((currentProjects - previousProjects) / previousProjects) * 100
      : currentProjects > 0 ? 100 : 0;

    // Average Rating
    const currentReviews = await prisma.review.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        rating: true,
      },
    });

    const previousReviews = await prisma.review.findMany({
      where: {
        createdAt: {
          gte: previousPeriod.startDate,
          lte: previousPeriod.endDate,
        },
      },
      select: {
        rating: true,
      },
    });

    const avgRating = currentReviews.length > 0
      ? currentReviews.reduce((sum, r) => sum + r.rating, 0) / currentReviews.length
      : 0;

    const prevAvgRating = previousReviews.length > 0
      ? previousReviews.reduce((sum, r) => sum + r.rating, 0) / previousReviews.length
      : 0;

    const ratingChange = prevAvgRating > 0
      ? avgRating - prevAvgRating
      : avgRating;

    // Total users count (not just new ones)
    const totalUsers = await prisma.user.count({
      where: {
        createdAt: {
          lte: endDate,
        },
      },
    });

    return {
      totalRevenue,
      revenueGrowth: parseFloat(revenueGrowth.toFixed(2)),
      totalUsers,
      userGrowth: parseFloat(userGrowth.toFixed(2)),
      totalProjects: currentProjects,
      projectGrowth: parseFloat(projectGrowth.toFixed(2)),
      avgRating: parseFloat(avgRating.toFixed(1)),
      ratingChange: parseFloat(ratingChange.toFixed(1)),
    };
  },

  async getMonthlyData(dateRange = "last_6_months", customStartDate = null, customEndDate = null) {
    const { startDate, endDate } = customStartDate && customEndDate
      ? { startDate: new Date(customStartDate), endDate: new Date(customEndDate) }
      : getDateRange(dateRange);

    // Generate months array
    const months = [];
    const current = new Date(startDate);
    current.setDate(1); // Start of month

    while (current <= endDate) {
      const monthStart = new Date(current);
      const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0, 23, 59, 59);

      // Revenue for this month
      const revenueData = await prisma.payment.aggregate({
        where: {
          status: "RELEASED",
          createdAt: {
            gte: monthStart,
            lte: monthEnd,
          },
        },
        _sum: {
          amount: true,
        },
      });

      // Projects created in this month
      const projects = await prisma.project.count({
        where: {
          createdAt: {
            gte: monthStart,
            lte: monthEnd,
          },
        },
      });

      // New users in this month
      const users = await prisma.user.count({
        where: {
          createdAt: {
            gte: monthStart,
            lte: monthEnd,
          },
        },
      });

      months.push({
        month: monthStart.toLocaleString("default", { month: "short" }),
        year: monthStart.getFullYear(),
        revenue: revenueData._sum.amount || 0,
        projects,
        users,
      });

      // Move to next month
      current.setMonth(current.getMonth() + 1);
    }

    return months;
  },

  async getCategoryBreakdown(dateRange = "last_30_days", customStartDate = null, customEndDate = null) {
    const { startDate, endDate } = customStartDate && customEndDate
      ? { startDate: new Date(customStartDate), endDate: new Date(customEndDate) }
      : getDateRange(dateRange);

    // Get all projects with payments in the date range
    const projects = await prisma.project.findMany({
      where: {
        createdAt: {
          lte: endDate,
        },
        milestones: {
          some: {
            payments: {
              some: {
                status: "RELEASED",
                createdAt: {
                  gte: startDate,
                  lte: endDate,
                },
              },
            },
          },
        },
      },
      include: {
        milestones: {
          include: {
            payments: {
              where: {
                status: "RELEASED",
                createdAt: {
                  gte: startDate,
                  lte: endDate,
                },
              },
            },
          },
        },
      },
    });

    // Group by category and calculate totals
    const categoryMap = {};

    projects.forEach((project) => {
      const category = project.category;
      if (!categoryMap[category]) {
        categoryMap[category] = {
          category,
          projects: 0,
          revenue: 0,
        };
      }

      categoryMap[category].projects += 1;
      project.milestones.forEach((milestone) => {
        milestone.payments.forEach((payment) => {
          categoryMap[category].revenue += payment.amount;
        });
      });
    });

    const categories = Object.values(categoryMap);
    const totalRevenue = categories.reduce((sum, c) => sum + c.revenue, 0);

    // Calculate percentages and format
    const result = categories.map((cat) => ({
      category: cat.category,
      projects: cat.projects,
      revenue: cat.revenue,
      percentage: totalRevenue > 0 ? (cat.revenue / totalRevenue) * 100 : 0,
    }));

    // Sort by revenue descending
    result.sort((a, b) => b.revenue - a.revenue);

    return result;
  },

  async getTopProviders(dateRange = "last_30_days", limit = 5, customStartDate = null, customEndDate = null) {
    const { startDate, endDate } = customStartDate && customEndDate
      ? { startDate: new Date(customStartDate), endDate: new Date(customEndDate) }
      : getDateRange(dateRange);

    // Get providers with their projects and payments (for revenue calculation)
    const providers = await prisma.user.findMany({
      where: {
        role: { has: "PROVIDER" },
        projectsAsProvider: {
          some: {
            milestones: {
              some: {
                payments: {
                  some: {
                    status: "RELEASED",
                    createdAt: {
                      gte: startDate,
                      lte: endDate,
                    },
                  },
                },
              },
            },
          },
        },
      },
      include: {
        providerProfile: {
          select: {
            rating: true,
            totalProjects: true, // Get totalProjects from profile
          },
        },
        projectsAsProvider: {
          where: {
            milestones: {
              some: {
                payments: {
                  some: {
                    status: "RELEASED",
                    createdAt: {
                      gte: startDate,
                      lte: endDate,
                    },
                  },
                },
              },
            },
          },
          include: {
            milestones: {
              include: {
                payments: {
                  where: {
                    status: "RELEASED",
                    createdAt: {
                      gte: startDate,
                      lte: endDate,
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    // Calculate revenue per provider and get total project count
    const providerStats = await Promise.all(
      providers
        .filter((provider) => provider && provider.id) // Ensure provider has ID
        .map(async (provider) => {
          let revenue = 0;

          // Calculate revenue from payments in date range
          provider.projectsAsProvider.forEach((project) => {
            project.milestones.forEach((milestone) => {
              milestone.payments.forEach((payment) => {
                revenue += payment.amount;
              });
            });
          });

          // Get total project count - use profile field to match user profile page
          // Fallback to direct count if profile field is missing or seems incorrect
          const directCount = await prisma.project.count({
            where: {
              providerId: provider.id,
            },
          });
          
          // Use totalProjects from profile (matches what user profile page shows)
          // If profile value is missing or seems incorrect, use direct count
          const profileTotalProjects = provider.providerProfile?.totalProjects;
          const projectCount = (profileTotalProjects !== null && profileTotalProjects !== undefined && profileTotalProjects >= 0)
            ? profileTotalProjects
            : directCount;

          return {
            id: provider.id,
            name: provider.name || "Unknown Provider",
            projects: projectCount,
            revenue: revenue || 0,
            rating: provider.providerProfile?.rating
              ? parseFloat(provider.providerProfile.rating.toString())
              : 0,
          };
        })
    );

    // Sort by revenue and limit
    providerStats.sort((a, b) => b.revenue - a.revenue);
    return providerStats.slice(0, limit);
  },

  async getTopCustomers(dateRange = "last_30_days", limit = 5, customStartDate = null, customEndDate = null) {
    const { startDate, endDate } = customStartDate && customEndDate
      ? { startDate: new Date(customStartDate), endDate: new Date(customEndDate) }
      : getDateRange(dateRange);

    // Get customers with their projects and payments (for spending calculation)
    const customers = await prisma.user.findMany({
      where: {
        role: { has: "CUSTOMER" },
        projectsAsCustomer: {
          some: {
            milestones: {
              some: {
                payments: {
                  some: {
                    status: "RELEASED",
                    createdAt: {
                      gte: startDate,
                      lte: endDate,
                    },
                  },
                },
              },
            },
          },
        },
      },
      include: {
        customerProfile: {
          select: {
            description: true,
            projectsPosted: true, // Get projectsPosted from profile
          },
        },
        projectsAsCustomer: {
          where: {
            milestones: {
              some: {
                payments: {
                  some: {
                    status: "RELEASED",
                    createdAt: {
                      gte: startDate,
                      lte: endDate,
                    },
                  },
                },
              },
            },
          },
          include: {
            milestones: {
              include: {
                payments: {
                  where: {
                    status: "RELEASED",
                    createdAt: {
                      gte: startDate,
                      lte: endDate,
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    // Calculate spending per customer and get total project count
    const customerStats = await Promise.all(
      customers
        .filter((customer) => customer && customer.id) // Ensure customer has ID
        .map(async (customer) => {
          let spent = 0;

          // Calculate spending from payments in date range
          customer.projectsAsCustomer.forEach((project) => {
            project.milestones.forEach((milestone) => {
              milestone.payments.forEach((payment) => {
                spent += payment.amount;
              });
            });
          });

          // Get total project count (all projects, not filtered by date)
          const totalProjects = await prisma.project.count({
            where: {
              customerId: customer.id,
            },
          });

          // For customers, show actual project count (not service requests)
          // This matches what would be shown in a user profile for "Projects" (not "Projects Posted")
          const projectCount = totalProjects;

          return {
            id: customer.id,
            name: customer.name || "Unknown Customer",
            projects: projectCount,
            spent: spent || 0,
          };
        })
    );

    // Sort by spending and limit
    customerStats.sort((a, b) => b.spent - a.spent);
    return customerStats.slice(0, limit);
  },

  async getCategoryDetails(category, dateRange = "last_30_days", customStartDate = null, customEndDate = null) {
    const { startDate, endDate } = customStartDate && customEndDate
      ? { startDate: new Date(customStartDate), endDate: new Date(customEndDate) }
      : getDateRange(dateRange);

    // Get all projects in this category with payments in the date range
    const projects = await prisma.project.findMany({
      where: {
        category: category,
        createdAt: {
          lte: endDate,
        },
        milestones: {
          some: {
            payments: {
              some: {
                status: "RELEASED",
                createdAt: {
                  gte: startDate,
                  lte: endDate,
                },
              },
            },
          },
        },
      },
      include: {
        provider: {
          select: {
            id: true,
            name: true,
            email: true,
            providerProfile: {
              select: {
                rating: true,
                location: true,
              },
            },
          },
        },
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
        milestones: {
          include: {
            payments: {
              where: {
                status: "RELEASED",
                createdAt: {
                  gte: startDate,
                  lte: endDate,
                },
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Calculate statistics
    let totalRevenue = 0;
    const providerIds = new Set();
    const customerIds = new Set();
    const projectRevenues = [];

    projects.forEach((project) => {
      let projectRevenue = 0;
      project.milestones.forEach((milestone) => {
        milestone.payments.forEach((payment) => {
          projectRevenue += payment.amount;
          totalRevenue += payment.amount;
        });
      });
      projectRevenues.push(projectRevenue);
      
      if (project.providerId) providerIds.add(project.providerId);
      if (project.customerId) customerIds.add(project.customerId);
    });

    const projectCount = projects.length;
    const averageProjectValue = projectCount > 0 ? totalRevenue / projectCount : 0;

    // Get unique providers and customers
    const providers = await prisma.user.findMany({
      where: {
        id: { in: Array.from(providerIds) },
      },
      select: {
        id: true,
        name: true,
        email: true,
        providerProfile: {
          select: {
            rating: true,
            location: true,
          },
        },
      },
    });

    const customers = await prisma.user.findMany({
      where: {
        id: { in: Array.from(customerIds) },
      },
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
    });

    // Get monthly trends for this category
    const monthlyTrends = await this.getCategoryMonthlyTrends(category, dateRange, customStartDate, customEndDate);

    // Format projects for response
    const formattedProjects = projects.map((project) => {
      let projectRevenue = 0;
      project.milestones.forEach((milestone) => {
        milestone.payments.forEach((payment) => {
          projectRevenue += payment.amount;
        });
      });

      return {
        id: project.id,
        title: project.title,
        status: project.status,
        createdAt: project.createdAt,
        provider: project.provider ? {
          id: project.provider.id,
          name: project.provider.name,
          rating: project.provider.providerProfile?.rating || 0,
        } : null,
        customer: project.customer ? {
          id: project.customer.id,
          name: project.customer.name,
        } : null,
        revenue: projectRevenue,
      };
    });

    return {
      category,
      totalRevenue,
      projectCount,
      averageProjectValue,
      providers: providers.map((p) => ({
        id: p.id,
        name: p.name,
        email: p.email,
        rating: p.providerProfile?.rating
          ? parseFloat(p.providerProfile.rating.toString())
          : 0,
        location: p.providerProfile?.location || null,
      })),
      customers: customers.map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        companySize: c.customerProfile?.companySize || null,
        industry: c.customerProfile?.industry || null,
      })),
      projects: formattedProjects,
      monthlyTrends,
    };
  },

  async getCategoryMonthlyTrends(category, dateRange = "last_30_days", customStartDate = null, customEndDate = null) {
    const { startDate, endDate } = customStartDate && customEndDate
      ? { startDate: new Date(customStartDate), endDate: new Date(customEndDate) }
      : getDateRange(dateRange);

    // Get monthly data for this category
    const months = [];
    const current = new Date(startDate);
    
    while (current <= endDate) {
      const monthStart = new Date(current.getFullYear(), current.getMonth(), 1);
      const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0, 23, 59, 59);

      // Get projects in this category for this month
      const monthProjects = await prisma.project.findMany({
        where: {
          category: category,
          milestones: {
            some: {
              payments: {
                some: {
                  status: "RELEASED",
                  createdAt: {
                    gte: monthStart,
                    lte: monthEnd,
                  },
                },
              },
            },
          },
        },
        include: {
          milestones: {
            include: {
              payments: {
                where: {
                  status: "RELEASED",
                  createdAt: {
                    gte: monthStart,
                    lte: monthEnd,
                  },
                },
              },
            },
          },
        },
      });

      let monthRevenue = 0;
      monthProjects.forEach((project) => {
        project.milestones.forEach((milestone) => {
          milestone.payments.forEach((payment) => {
            monthRevenue += payment.amount;
          });
        });
      });

      months.push({
        month: current.toLocaleString("default", { month: "short" }),
        year: current.getFullYear(),
        revenue: monthRevenue,
        projects: monthProjects.length,
      });

      // Move to next month
      current.setMonth(current.getMonth() + 1);
    }

    return months;
  },
};

export default prisma;

