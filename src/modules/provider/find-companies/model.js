// src/modules/provider/find-companies/model.js
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Find companies with filtering and pagination
export async function findCompanies(filters) {
  const {
    search,
    industry,
    location,
    rating,
    sortBy,
    page,
    limit,
    companySize,
    verified,
    userId,
  } = filters;

  const skip = (page - 1) * limit;

  // Build where clause
  const where = {
    role: {
      has: "CUSTOMER",
    },
    customerProfile: {
      isNot: null,
    },
  };

  // Search filter
  if (search) {
    where.OR = [
      {
        name: {
          contains: search,
          mode: "insensitive",
        },
      },
      {
        customerProfile: {
          description: {
            contains: search,
            mode: "insensitive",
          },
        },
      },
      {
        customerProfile: {
          industry: {
            contains: search,
            mode: "insensitive",
          },
        },
      },
    ];
  }

  // Industry filter
  if (industry && industry !== "all") {
    where.customerProfile = {
      ...where.customerProfile,
      industry: {
        contains: industry,
        mode: "insensitive",
      },
    };
  }

  // Location filter
  if (location && location !== "all") {
    where.customerProfile = {
      ...where.customerProfile,
      location: {
        contains: location,
        mode: "insensitive",
      },
    };
  }

  // Rating filter
  if (rating && rating !== "all") {
    const minRating = parseFloat(rating.replace("+", ""));
    where.customerProfile = {
      ...where.customerProfile,
      rating: {
        gte: minRating,
      },
    };
  }

  // Company size filter
  if (companySize && companySize !== "all") {
    where.customerProfile = {
      ...where.customerProfile,
      companySize: {
        contains: companySize,
        mode: "insensitive",
      },
    };
  }

  // Verified filter (from User table)
  if (verified !== undefined) {
    where.isVerified = verified === true;
  }

  // Build order by
  let orderBy = {};
  switch (sortBy) {
    case "rating":
      orderBy = { customerProfile: { rating: "desc" } };
      break;
    case "projects":
      // Order by number of projects posted (descending)
      orderBy = { customerProfile: { projectsPosted: "desc" } };
      break;
    case "spend":
      // Order by total spend (descending)
      orderBy = { customerProfile: { totalSpend: "desc" } };
      break;
    case "newest":
      orderBy = { createdAt: "desc" };
      break;
    default:
      orderBy = { customerProfile: { rating: "desc" } };
  }

  // Execute query
  const [companies, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: {
        customerProfile: {
          select: {
            id: true,
            industry: true,
            location: true,
            companySize: true,
            rating: true,
            reviewCount: true,
            totalSpend: true,
            projectsPosted: true,
            description: true,
            website: true,
            profileImageUrl: true, // 🆕 Profile image
            employeeCount: true,
            establishedYear: true,
            annualRevenue: true,
            fundingStage: true,
            mission: true,
            values: true,
            languages: true,
            categoriesHiringFor: true,
            preferredContractTypes: true,
            remotePolicy: true,
            hiringFrequency: true,
            averageBudgetRange: true,
            socialLinks: true,
            mediaGallery: true,
          },
        },
        settings: true, // Include privacy settings
      },
      orderBy,
      skip,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  // If userId is provided, check saved status for each company
  const companyIds = companies.map(c => c.id);
  let companiesWithSavedStatus = companies;
  if (userId) {
    // Get all saved companies for this user in one query
    const savedCompanyIds = await prisma.savedCompany.findMany({
      where: {
        userId: userId,
        companyId: {
          in: companyIds,
        },
      },
      select: {
        companyId: true,
      },
    });

    const savedIdsSet = new Set(savedCompanyIds.map(sc => sc.companyId));

    // Add isSaved property (projectsPosted already comes from database)
    companiesWithSavedStatus = companies.map(company => ({
      ...company,
      isSaved: savedIdsSet.has(company.id),
      // projectsPosted is already in customerProfile from the query above
    }));
  } else {
    // If no userId, set isSaved to false for all (projectsPosted already comes from database)
    companiesWithSavedStatus = companies.map(company => ({
      ...company,
      isSaved: false,
      // projectsPosted is already in customerProfile from the query above
    }));
  }

  return {
    companies: companiesWithSavedStatus,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

// Get company by ID with full details
export async function getCompanyById(companyId, userId = null) {
  const company = await prisma.user.findUnique({
    where: {
      id: companyId,
      role: {
        has: "CUSTOMER",
      },
    },
    include: {
      customerProfile: {
        select: {
          id: true,
          industry: true,
          location: true,
          companySize: true,
          rating: true,
          reviewCount: true,
          totalSpend: true,
          projectsPosted: true,
          description: true,
          website: true,
          profileImageUrl: true, // 🆕 Profile image
          employeeCount: true,
          establishedYear: true,
          annualRevenue: true,
          fundingStage: true,
          mission: true,
          values: true,
          languages: true,
          categoriesHiringFor: true,
          preferredContractTypes: true,
          remotePolicy: true,
          hiringFrequency: true,
          averageBudgetRange: true,
          socialLinks: true,
          mediaGallery: true,
        },
      },
      settings: true, // Include privacy settings
    },
  });

  if (!company) {
    throw new Error("Company not found");
  }

  // Check if saved by user
  let isSaved = false;
  if (userId) {
    const savedCompany = await prisma.savedCompany.findUnique({
      where: {
        userId_companyId: {
          userId,
          companyId,
        },
      },
    });
    isSaved = !!savedCompany;
  }

  return {
    ...company,
    isSaved,
    // projectsPosted is already in customerProfile from the query above (from database)
  };
}

// Get company reviews (reviews given by this company about providers)
export async function getCompanyReviews(companyId, page = 1, limit = 10) {
  const skip = (page - 1) * limit;

  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where: {
        reviewerId: companyId,
      },
      include: {
        recipient: {
          select: {
            id: true,
            name: true,
            providerProfile: {
              select: {
                location: true,
                rating: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take: limit,
    }),
    prisma.review.count({
      where: {
        reviewerId: companyId,
      },
    }),
  ]);

  return {
    reviews,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

// Save/unsave company
export async function saveCompany(userId, companyId) {
  // Check if already saved
  const existing = await prisma.savedCompany.findUnique({
    where: {
      userId_companyId: {
        userId,
        companyId,
      },
    },
  });

  if (existing) {
    throw new Error("Company already saved");
  }

  return await prisma.savedCompany.create({
    data: {
      userId,
      companyId,
    },
  });
}

// Unsave company
export async function unsaveCompany(userId, companyId) {
  const deleted = await prisma.savedCompany.delete({
    where: {
      userId_companyId: {
        userId,
        companyId,
      },
    },
  });

  return deleted;
}

// Get saved companies for user
export async function getSavedCompanies(userId, page = 1, limit = 20) {
  const skip = (page - 1) * limit;

  const [savedCompanies, total] = await Promise.all([
    prisma.savedCompany.findMany({
      where: {
        userId,
      },
      include: {
        company: {
          include: {
            settings: true, // Include privacy settings
            customerProfile: {
              select: {
                id: true,
                industry: true,
                location: true,
                companySize: true,
                rating: true,
                reviewCount: true,
                totalSpend: true,
                projectsPosted: true,
                description: true,
                website: true,
                profileImageUrl: true, // 🆕 Profile image
                employeeCount: true,
                establishedYear: true,
                annualRevenue: true,
                fundingStage: true,
                mission: true,
                values: true,
                languages: true,
                categoriesHiringFor: true,
                preferredContractTypes: true,
                remotePolicy: true,
                hiringFrequency: true,
                averageBudgetRange: true,
                socialLinks: true,
                mediaGallery: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take: limit,
    }),
    prisma.savedCompany.count({
      where: {
        userId,
      },
    }),
  ]);

  return {
    companies: savedCompanies.map((sc) => ({
      ...sc.company,
      savedAt: sc.createdAt,
      isSaved: true,
      // projectsPosted is already in customerProfile from the query above (from database)
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

// Get company statistics
export async function getCompanyStats(companyId) {
  const [
    totalProjects,
    completedProjects,
    totalReviews,
    averageRating,
    totalSpend,
  ] = await Promise.all([
    prisma.project.count({
      where: {
        customerId: companyId,
      },
    }),
    prisma.project.count({
      where: {
        customerId: companyId,
        status: "COMPLETED",
      },
    }),
    prisma.review.count({
      where: {
        reviewerId: companyId,
      },
    }),
    prisma.review.aggregate({
      where: {
        reviewerId: companyId,
      },
      _avg: {
        rating: true,
      },
    }),
    prisma.payment.aggregate({
      where: {
        project: {
          customerId: companyId,
        },
        status: "RELEASED",
      },
      _sum: {
        amount: true,
      },
    }),
  ]);

  return {
    totalProjects,
    completedProjects,
    totalReviews,
    averageRating: averageRating._avg.rating || 0,
    totalSpend: totalSpend._sum.amount || 0,
    completionRate: totalProjects > 0 ? (completedProjects / totalProjects) * 100 : 0,
  };
}

// Get AiDrafts for companies (optionally filtered by referenceIds array)
export async function getAiDraftsForCompanies(referenceIds = null) {
  const where = { type: "CUSTOMER" };
  if (Array.isArray(referenceIds) && referenceIds.length > 0) {
    where.referenceId = { in: referenceIds };
  }

  const drafts = await prisma.aiDraft.findMany({
    where,
    select: {
      id: true,
      referenceId: true,
      summary: true,
      version: true,
      createdAt: true,
    },
  });

  return drafts;
}

