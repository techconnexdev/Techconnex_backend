// src/modules/provider/find-companies/service.js
import {
  findCompanies,
  getCompanyById,
  getCompanyReviews,
  saveCompany,
  unsaveCompany,
  getSavedCompanies,
  getCompanyStats,
  getAiDraftsForCompanies,
} from "./model.js";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Find companies with filtering
export async function searchCompanies(filters) {
  try {
    const result = await findCompanies(filters);
    
    // Transform data for frontend
    const transformedCompanies = result.companies.map((user) => {
      // Get privacy settings
      const settings = user.settings || {};
      const showEmail = settings.showEmail || false;
      const showPhone = settings.showPhone || false;
      const allowMessages = settings.allowMessages !== false; // Default to true if not set
      
      return {
        id: user.id,
        name: user.name,
        // Only include email/phone if privacy settings allow
        email: showEmail ? user.email : null,
        phone: showPhone ? user.phone : null,
        allowMessages: allowMessages,
        avatar: user.customerProfile?.profileImageUrl || "/placeholder.svg",
        industry: user.customerProfile?.industry || "Not specified",
      location: user.customerProfile?.location || "Not specified",
      companySize: user.customerProfile?.companySize || "Not specified",
      rating: parseFloat(user.customerProfile?.rating || 0),
      reviewCount: user.customerProfile?.reviewCount || 0,
      totalSpend: parseFloat(user.customerProfile?.totalSpend || 0),
      projectsPosted: user.customerProfile?.projectsPosted || 0,
      description: user.customerProfile?.description || "No description available",
      website: user.customerProfile?.website || null,
      memberSince: new Date(user.createdAt).getFullYear().toString(),
      verified: user.isVerified || false,
      saved: user.isSaved || false, // Use saved status from backend
      customerProfileId: user.customerProfile?.id || null, // For fetching AI drafts
      // Additional public-safe fields
      employeeCount: user.customerProfile?.employeeCount || null,
      establishedYear: user.customerProfile?.establishedYear || null,
      annualRevenue: user.customerProfile?.annualRevenue || null,
      fundingStage: user.customerProfile?.fundingStage || null,
      mission: user.customerProfile?.mission || null,
      values: user.customerProfile?.values || [],
      languages: user.customerProfile?.languages || [],
      categoriesHiringFor: user.customerProfile?.categoriesHiringFor || [],
      preferredContractTypes: user.customerProfile?.preferredContractTypes || [],
      remotePolicy: user.customerProfile?.remotePolicy || null,
      hiringFrequency: user.customerProfile?.hiringFrequency || null,
      averageBudgetRange: user.customerProfile?.averageBudgetRange || null,
      socialLinks: user.customerProfile?.socialLinks || null,
      mediaGallery: user.customerProfile?.mediaGallery || [],
      };
    });

    return {
      companies: transformedCompanies,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    };
  } catch (error) {
    console.error("Error searching companies:", error);
    throw new Error("Failed to search companies");
  }
}

// Get company details
export async function getCompanyDetails(companyId, userId = null) {
  try {
    const company = await getCompanyById(companyId, userId);
    
    // Get privacy settings
    const settings = company.settings || {};
    const showEmail = settings.showEmail || false;
    const showPhone = settings.showPhone || false;
    const allowMessages = settings.allowMessages !== false; // Default to true if not set
    
    // Transform for frontend
    const transformedCompany = {
      id: company.id,
      name: company.name,
      // Only include email/phone if privacy settings allow
      email: showEmail ? company.email : null,
      phone: showPhone ? company.phone : null,
      allowMessages: allowMessages, // Include this flag for frontend
      avatar: company.customerProfile?.profileImageUrl || "/placeholder.svg",
      industry: company.customerProfile?.industry || "Not specified",
      location: company.customerProfile?.location || "Not specified",
      companySize: company.customerProfile?.companySize || "Not specified",
      rating: parseFloat(company.customerProfile?.rating || 0),
      reviewCount: company.customerProfile?.reviewCount || 0,
      totalSpend: parseFloat(company.customerProfile?.totalSpend || 0),
      projectsPosted: company.customerProfile?.projectsPosted || 0,
      description: company.customerProfile?.description || "No description available",
      website: company.customerProfile?.website || null,
      memberSince: new Date(company.createdAt).getFullYear().toString(),
      verified: company.isVerified || false,
      saved: company.isSaved || false,
      customerProfileId: company.customerProfile?.id || null, // For fetching AI drafts
      // Additional fields
      employeeCount: company.customerProfile?.employeeCount || null,
      establishedYear: company.customerProfile?.establishedYear || null,
      annualRevenue: company.customerProfile?.annualRevenue || null,
      fundingStage: company.customerProfile?.fundingStage || null,
      mission: company.customerProfile?.mission || null,
      values: company.customerProfile?.values || [],
      languages: company.customerProfile?.languages || [],
      categoriesHiringFor: company.customerProfile?.categoriesHiringFor || [],
      preferredContractTypes: company.customerProfile?.preferredContractTypes || [],
      remotePolicy: company.customerProfile?.remotePolicy || null,
      hiringFrequency: company.customerProfile?.hiringFrequency || null,
      averageBudgetRange: company.customerProfile?.averageBudgetRange || null,
      socialLinks: company.customerProfile?.socialLinks || null,
      mediaGallery: company.customerProfile?.mediaGallery || [],
    };

    return transformedCompany;
  } catch (error) {
    console.error("Error getting company details:", error);
    throw new Error("Failed to get company details");
  }
}

// Get company reviews
export async function getCompanyReviewsList(companyId, page = 1, limit = 10) {
  try {
    const result = await getCompanyReviews(companyId, page, limit);
    
    // Transform reviews for frontend
    const transformedReviews = result.reviews.map((review) => ({
      id: review.id,
      author: review.recipient.name,
      rating: review.rating,
      date: review.createdAt.toISOString().split("T")[0],
      text: review.content,
      provider: {
        name: review.recipient.name,
        location: review.recipient.providerProfile?.location || "Not specified",
        rating: parseFloat(review.recipient.providerProfile?.rating || 0),
      },
    }));

    return {
      reviews: transformedReviews,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    };
  } catch (error) {
    console.error("Error getting company reviews:", error);
    throw new Error("Failed to get company reviews");
  }
}

// Save company
export async function saveCompanyService(userId, companyId) {
  try {
    await saveCompany(userId, companyId);
    return { success: true, message: "Company saved successfully" };
  } catch (error) {
    if (error.message === "Company already saved") {
      throw new Error("Company already saved");
    }
    console.error("Error saving company:", error);
    throw new Error("Failed to save company");
  }
}

// Unsave company
export async function unsaveCompanyService(userId, companyId) {
  try {
    await unsaveCompany(userId, companyId);
    return { success: true, message: "Company removed from saved list" };
  } catch (error) {
    console.error("Error unsaving company:", error);
    throw new Error("Failed to remove company from saved list");
  }
}

// Get saved companies
export async function getSavedCompaniesService(userId, page = 1, limit = 20) {
  try {
    const result = await getSavedCompanies(userId, page, limit);
    
    // Transform for frontend
    const transformedCompanies = result.companies.map((user) => {
      // Get privacy settings - note: saved companies have user.company structure
      const company = user.company || user;
      const settings = company.settings || {};
      const showEmail = settings.showEmail || false;
      const showPhone = settings.showPhone || false;
      const allowMessages = settings.allowMessages !== false; // Default to true if not set
      
      return {
        id: company.id,
        name: company.name,
        // Only include email/phone if privacy settings allow
        email: showEmail ? company.email : null,
        phone: showPhone ? company.phone : null,
        allowMessages: allowMessages,
        avatar: company.customerProfile?.profileImageUrl || "/placeholder.svg",
        industry: company.customerProfile?.industry || "Not specified",
        location: company.customerProfile?.location || "Not specified",
        companySize: company.customerProfile?.companySize || "Not specified",
        rating: parseFloat(company.customerProfile?.rating || 0),
        reviewCount: company.customerProfile?.reviewCount || 0,
        totalSpend: parseFloat(company.customerProfile?.totalSpend || 0),
        projectsPosted: company.customerProfile?.projectsPosted || 0,
        description: company.customerProfile?.description || "No description available",
        website: company.customerProfile?.website || null,
        memberSince: new Date(company.createdAt).getFullYear().toString(),
        verified: company.isVerified || false,
        savedAt: user.createdAt || user.savedAt,
        // Additional public-safe fields
        employeeCount: company.customerProfile?.employeeCount || null,
        establishedYear: company.customerProfile?.establishedYear || null,
        annualRevenue: company.customerProfile?.annualRevenue || null,
        fundingStage: company.customerProfile?.fundingStage || null,
        mission: company.customerProfile?.mission || null,
        values: company.customerProfile?.values || [],
        languages: company.customerProfile?.languages || [],
        categoriesHiringFor: company.customerProfile?.categoriesHiringFor || [],
        preferredContractTypes: company.customerProfile?.preferredContractTypes || [],
        remotePolicy: company.customerProfile?.remotePolicy || null,
        hiringFrequency: company.customerProfile?.hiringFrequency || null,
        averageBudgetRange: company.customerProfile?.averageBudgetRange || null,
        socialLinks: company.customerProfile?.socialLinks || null,
        mediaGallery: company.customerProfile?.mediaGallery || [],
      };
    });

    return {
      companies: transformedCompanies,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    };
  } catch (error) {
    console.error("Error getting saved companies:", error);
    throw new Error("Failed to get saved companies");
  }
}

// Get company statistics
export async function getCompanyStatistics(companyId) {
  try {
    const stats = await getCompanyStats(companyId);
    return stats;
  } catch (error) {
    console.error("Error getting company statistics:", error);
    throw new Error("Failed to get company statistics");
  }
}

// Get opportunities (OPEN ServiceRequests) for a specific company
export async function getCompanyOpportunities(companyId, providerId) {
  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    
    // Get OPEN ServiceRequests for this company
    const serviceRequests = await prisma.serviceRequest.findMany({
      where: {
        customerId: companyId,
        status: "OPEN",
      },
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
                location: true,
                website: true,
                profileImageUrl: true,
                totalSpend: true,
              },
            },
          },
        },
        milestones: {
          orderBy: {
            order: "asc",
          },
        },
        _count: {
          select: {
            proposals: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 50, // Limit to 50 most recent opportunities
    });

    // Check which ServiceRequests the current provider has already proposed to
    const serviceRequestIds = serviceRequests.map(sr => sr.id);
    const existingProposals = providerId ? await prisma.proposal.findMany({
      where: {
        providerId: providerId,
        serviceRequestId: {
          in: serviceRequestIds,
        },
      },
      select: {
        serviceRequestId: true,
      },
    }) : [];

    const proposedServiceRequestIds = new Set(existingProposals.map(p => p.serviceRequestId));

    // Transform opportunities for frontend
    const opportunities = serviceRequests.map((sr) => ({
      id: sr.id,
      title: sr.title,
      description: sr.description,
      category: sr.category,
      budgetMin: sr.budgetMin,
      budgetMax: sr.budgetMax,
      timeline: sr.timeline,
      skills: sr.skills || [],
      priority: sr.priority,
      requirements: Array.isArray(sr.requirements) ? sr.requirements : [],
      deliverables: Array.isArray(sr.deliverables) ? sr.deliverables : [],
      createdAt: sr.createdAt,
      updatedAt: sr.updatedAt,
      milestones: sr.milestones || [],
      proposalCount: sr._count?.proposals || 0,
      hasProposed: proposedServiceRequestIds.has(sr.id),
      customer: {
        id: sr.customer.id,
        name: sr.customer.name,
        email: sr.customer.email,
        customerProfile: sr.customer.customerProfile,
      },
    }));

    await prisma.$disconnect();
    return opportunities;
  } catch (error) {
    console.error("Error getting company opportunities:", error);
    throw new Error("Failed to get company opportunities");
  }
}

// Fetch AiDrafts for companies
export async function getAiDraftsService(referenceIds = null) {
  try {
    const drafts = await getAiDraftsForCompanies(referenceIds);
    return drafts;
  } catch (error) {
    console.error("Error fetching AiDrafts:", error);
    throw new Error("Failed to fetch AI drafts");
  }
}

// Get filter options (industries, locations, etc.)
export async function getFilterOptions() {
  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    
    // Get unique industries
    const industriesResult = await prisma.customerProfile.findMany({
      select: {
        industry: true,
      },
      where: {
        industry: {
          not: null,
        },
      },
    });
    
    const uniqueIndustries = [...new Set(industriesResult.map(p => p.industry).filter(Boolean))];
    
    // Get unique locations
    const locationsResult = await prisma.customerProfile.findMany({
      select: {
        location: true,
      },
      where: {
        location: {
          not: null,
        },
      },
    });
    
    const uniqueLocations = [...new Set(locationsResult.map(p => p.location).filter(Boolean))];
    
    // Get unique company sizes
    const companySizesResult = await prisma.customerProfile.findMany({
      select: {
        companySize: true,
      },
      where: {
        companySize: {
          not: null,
        },
      },
    });
    
    const uniqueCompanySizes = [...new Set(companySizesResult.map(p => p.companySize).filter(Boolean))];
    
    return {
      industries: [
        { value: "all", label: "All Industries" },
        ...uniqueIndustries.slice(0, 10).map(industry => ({
          value: industry.toLowerCase(),
          label: industry,
        })),
      ],
      locations: [
        { value: "all", label: "All Locations" },
        ...uniqueLocations.slice(0, 10).map(location => ({
          value: location.toLowerCase(),
          label: location,
        })),
      ],
      companySizes: [
        { value: "all", label: "All Company Sizes" },
        ...uniqueCompanySizes.slice(0, 10).map(size => ({
          value: size.toLowerCase(),
          label: size,
        })),
      ],
      ratings: [
        { value: "all", label: "All Ratings" },
        { value: "5.0+", label: "5.0 Stars" },
        { value: "4.8+", label: "4.8+ Stars" },
        { value: "4.5+", label: "4.5+ Stars" },
        { value: "4.0+", label: "4.0+ Stars" },
        { value: "3.5+", label: "3.5+ Stars" },
        { value: "3.0+", label: "3.0+ Stars" },
        { value: "2.5+", label: "2.5+ Stars" },
        { value: "2.0+", label: "2.0+ Stars" },
        { value: "1.5+", label: "1.5+ Stars" },
        { value: "1.0+", label: "1.0+ Stars" },
      ],
    };
  } catch (error) {
    console.error("Error getting filter options:", error);
    // Return default options if database query fails
    return {
      industries: [
        { value: "all", label: "All Industries" },
        { value: "technology", label: "Technology" },
        { value: "finance", label: "Finance" },
        { value: "healthcare", label: "Healthcare" },
        { value: "education", label: "Education" },
        { value: "retail", label: "Retail" },
      ],
      locations: [
        { value: "all", label: "All Locations" },
        { value: "kuala lumpur", label: "Kuala Lumpur" },
        { value: "selangor", label: "Selangor" },
        { value: "penang", label: "Penang" },
        { value: "johor", label: "Johor" },
      ],
      companySizes: [
        { value: "all", label: "All Company Sizes" },
        { value: "1-10", label: "1-10 employees" },
        { value: "11-50", label: "11-50 employees" },
        { value: "51-200", label: "51-200 employees" },
        { value: "201+", label: "201+ employees" },
      ],
      ratings: [
        { value: "all", label: "All Ratings" },
        { value: "5.0+", label: "5.0 Stars" },
        { value: "4.8+", label: "4.8+ Stars" },
        { value: "4.5+", label: "4.5+ Stars" },
        { value: "4.0+", label: "4.0+ Stars" },
        { value: "3.5+", label: "3.5+ Stars" },
        { value: "3.0+", label: "3.0+ Stars" },
        { value: "2.5+", label: "2.5+ Stars" },
        { value: "2.0+", label: "2.0+ Stars" },
        { value: "1.5+", label: "1.5+ Stars" },
        { value: "1.0+", label: "1.0+ Stars" },
      ],
    };
  }
}

