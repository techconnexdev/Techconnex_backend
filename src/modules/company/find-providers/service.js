// src/modules/company/find-providers/service.js
import {
  findProviders,
  getProviderById,
  getProviderReviews,
  saveProvider,
  unsaveProvider,
  getSavedProviders,
  getProviderStats,
} from "./model.js";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Find providers with filtering
export async function searchProviders(filters) {
  try {
    const result = await findProviders(filters);

    // Transform data for frontend
    const transformedProviders = result.providers.map((user) => ({
      profileId: user.providerProfile?.id || null,
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.providerProfile?.profileImageUrl || "/placeholder.svg",
      major: user.providerProfile?.major || "ICT Professional",
      company: user.providerProfile?.website || "Freelancer",
      rating: parseFloat(user.providerProfile?.rating || 0),
      reviewCount: user.providerProfile?.totalReviews || 0,
      completedJobs: user.completedProjects || 0, // Use calculated completed projects
      hourlyRate: user.providerProfile?.hourlyRate || 0,
      location: user.providerProfile?.location || "Malaysia",
      bio: user.providerProfile?.bio || "Experienced ICT professional",
      availability: user.providerProfile?.availability || "Available",
      responseTime: `${user.providerProfile?.responseTime || 24} hours`,
      skills: user.providerProfile?.skills || [],
      specialties: user.providerProfile?.skills?.slice(0, 3) || [],
      languages: user.providerProfile?.languages || ["English"],
      verified: user.isVerified || false,
      topRated: user.providerProfile?.isFeatured || false,
      saved: user.isSaved || false, // Use saved status from backend
      // Additional public-safe fields
      yearsExperience: user.providerProfile?.yearsExperience || 0,
      minimumProjectBudget: user.providerProfile?.minimumProjectBudget || null,
      maximumProjectBudget: user.providerProfile?.maximumProjectBudget || null,
      preferredProjectDuration:
        user.providerProfile?.preferredProjectDuration || null,
      workPreference: user.providerProfile?.workPreference || "remote",
      teamSize: user.providerProfile?.teamSize || 1,
      website: user.providerProfile?.website || null,
      portfolioLinks: user.providerProfile?.portfolioLinks || [],
      certificationsCount: user.providerProfile?.certifications?.length || 0,
      certifications: (user.providerProfile?.certifications || []).map(
        (cert) => ({
          id: cert.id,
          name: cert.name,
          issuer: cert.issuer,
          issuedDate: cert.issuedDate,
          verified: cert.verified,
        })
      ),
    }));

    return {
      providers: transformedProviders,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    };
  } catch (error) {
    console.error("Error searching providers:", error);
    throw new Error("Failed to search providers");
  }
}

// Fetch AiDrafts for providers
export async function getAiDraftsService(referenceIds = null) {
  try {
    const { getAiDraftsForProviders } = await import("./model.js");
    const drafts = await getAiDraftsForProviders(referenceIds);
    return drafts;
  } catch (error) {
    console.error("Error fetching AiDrafts:", error);
    throw new Error("Failed to fetch AI drafts");
  }
}

// Get provider details
export async function getProviderDetails(providerId, userId = null) {
  try {
    const provider = await getProviderById(providerId, userId);

    // Get privacy settings
    const settings = provider.settings || {};
    const showEmail = settings.showEmail || false;
    const showPhone = settings.showPhone || false;
    const allowMessages = settings.allowMessages !== false; // Default to true if not set

    // Transform for frontend
    const transformedProvider = {
      id: provider.id,
      name: provider.name,
      // Only include email/phone if privacy settings allow
      email: showEmail ? provider.email : null,
      phone: showPhone ? provider.phone : null,
      allowMessages: allowMessages, // Include this flag for frontend
      avatar: provider.providerProfile?.profileImageUrl || "/placeholder.svg",
      major: provider.providerProfile?.major || "ICT Professional",
      company: provider.providerProfile?.website || "Freelancer",
      rating: parseFloat(provider.providerProfile?.rating || 0),
      reviewCount: provider.providerProfile?.totalReviews || 0,
      completedJobs: provider.completedProjects || 0, // Use calculated completed projects
      hourlyRate: provider.providerProfile?.hourlyRate || 0,
      location: provider.providerProfile?.location || "Malaysia",
      bio: provider.providerProfile?.bio || "Experienced ICT professional",
      availability: provider.providerProfile?.availability || "Available",
      responseTime: `${provider.providerProfile?.responseTime || 24} hours`,
      skills: provider.providerProfile?.skills || [],
      specialties: provider.providerProfile?.skills?.slice(0, 3) || [],
      languages: provider.providerProfile?.languages || ["English"],
      verified: provider.isVerified || false,
      topRated: provider.providerProfile?.isFeatured || false,
      saved: provider.isSaved || false,
      // Additional public-safe fields
      yearsExperience: provider.providerProfile?.yearsExperience || 0,
      minimumProjectBudget:
        provider.providerProfile?.minimumProjectBudget || null,
      maximumProjectBudget:
        provider.providerProfile?.maximumProjectBudget || null,
      preferredProjectDuration:
        provider.providerProfile?.preferredProjectDuration || null,
      workPreference: provider.providerProfile?.workPreference || "remote",
      teamSize: provider.providerProfile?.teamSize || 1,
      website: provider.providerProfile?.website || null,
      portfolioLinks: provider.providerProfile?.portfolioLinks || [],
      certificationsCount:
        provider.providerProfile?.certifications?.length || 0,
      certifications: (provider.providerProfile?.certifications || []).map(
        (cert) => ({
          id: cert.id,
          name: cert.name,
          issuer: cert.issuer,
          issuedDate: cert.issuedDate,
          verified: cert.verified,
        })
      ),
    };

    return transformedProvider;
  } catch (error) {
    console.error("Error getting provider details:", error);
    throw new Error("Failed to get provider details");
  }
}

// Get provider portfolio (external work)
export async function getProviderPortfolio(providerId) {
  try {
    const provider = await getProviderById(providerId);

    // Transform portfolio items (external work from ProjectPortfolio)
    const portfolio = (provider.providerProfile?.portfolios || []).map(
      (item) => {
        // Normalize image URL - handle both relative paths and full URLs
        let coverUrl = "/placeholder.svg";
        if (item.imageUrl) {
          const normalizedUrl = item.imageUrl.replace(/\\/g, "/");
          coverUrl = normalizedUrl.startsWith("http")
            ? normalizedUrl
            : normalizedUrl.startsWith("/")
            ? normalizedUrl
            : `/${normalizedUrl}`;
        }

        return {
          id: item.id,
          title: item.title,
          description: item.description || "",
          cover: coverUrl,
          url: item.externalUrl || "#",
          tags: item.techStack || [],
          client: item.client || null,
          date: item.date
            ? new Date(item.date).toISOString().split("T")[0]
            : null,
        };
      }
    );

    return portfolio;
  } catch (error) {
    console.error("Error getting provider portfolio:", error);
    throw new Error("Failed to get provider portfolio");
  }
}

// Get completed projects for provider portfolio
export async function getProviderCompletedProjects(providerId) {
  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();

    const projects = await prisma.project.findMany({
      where: {
        providerId: providerId,
        status: "COMPLETED",
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            customerProfile: {
              select: {
                companySize: true,
                industry: true,
                profileImageUrl: true,
              },
            },
          },
        },
        milestones: {
          select: {
            id: true,
            title: true,
            amount: true,
            status: true,
          },
          orderBy: {
            order: "asc",
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: 50, // Limit to 50 most recent completed projects
    });

    // Transform projects for portfolio display (public-safe data)
    const portfolioProjects = projects.map((project) => {
      // Calculate approved price (sum of milestone amounts)
      const approvedPrice = project.milestones.reduce(
        (sum, m) => sum + (m.amount || 0),
        0
      );

      // Get skills from project (public data)
      const technologies = Array.isArray(project.skills) ? project.skills : [];

      return {
        id: project.id,
        title: project.title,
        description: project.description,
        category: project.category,
        technologies: technologies.slice(0, 8), // Limit to 8 technologies for display
        client: project.customer?.name || "Client",
        clientId: project.customer?.id || null,
        completedDate: project.updatedAt
          ? new Date(project.updatedAt).toISOString().split("T")[0]
          : null,
        approvedPrice,
        image: null, // Projects don't have images, but we can use placeholder or category icon
      };
    });

    await prisma.$disconnect();
    return portfolioProjects;
  } catch (error) {
    console.error("Error getting completed projects:", error);
    throw new Error("Failed to get completed projects");
  }
}

// Get provider reviews
export async function getProviderReviewsList(providerId, page = 1, limit = 10) {
  try {
    const result = await getProviderReviews(providerId, page, limit);

    // Transform reviews for frontend
    const transformedReviews = result.reviews.map((review) => ({
      id: review.id,
      author: review.company || review.reviewer.name,
      rating: review.rating,
      date: review.createdAt.toISOString().split("T")[0],
      text: review.content,
      reviewer: {
        name: review.reviewer.name,
        company: review.company,
        role: review.role,
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
    console.error("Error getting provider reviews:", error);
    throw new Error("Failed to get provider reviews");
  }
}

// Save provider
export async function saveProviderService(userId, providerId) {
  try {
    await saveProvider(userId, providerId);
    return { success: true, message: "Provider saved successfully" };
  } catch (error) {
    if (error.message === "Provider already saved") {
      throw new Error("Provider already saved");
    }
    console.error("Error saving provider:", error);
    throw new Error("Failed to save provider");
  }
}

// Unsave provider
export async function unsaveProviderService(userId, providerId) {
  try {
    await unsaveProvider(userId, providerId);
    return { success: true, message: "Provider removed from saved list" };
  } catch (error) {
    console.error("Error unsaving provider:", error);
    throw new Error("Failed to remove provider from saved list");
  }
}

// Get saved providers
export async function getSavedProvidersService(userId, page = 1, limit = 20) {
  try {
    const result = await getSavedProviders(userId, page, limit);

    // Calculate completed projects for saved providers
    const savedProviderIds = result.providers.map((p) => p.id);
    const completedProjectsCounts = await prisma.project.groupBy({
      by: ["providerId"],
      where: {
        providerId: {
          in: savedProviderIds,
        },
        status: "COMPLETED",
      },
      _count: {
        id: true,
      },
    });

    // Create a map of providerId -> completedProjects count
    const completedProjectsMap = new Map(
      completedProjectsCounts.map((item) => [item.providerId, item._count.id])
    );

    // Transform for frontend
    const transformedProviders = result.providers.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.providerProfile?.profileImageUrl || "/placeholder.svg",
      major: user.providerProfile?.major || "ICT Professional",
      company: user.providerProfile?.website || "Freelancer",
      rating: parseFloat(user.providerProfile?.rating || 0),
      reviewCount: user.providerProfile?.totalReviews || 0,
      completedJobs: completedProjectsMap.get(user.id) || 0, // Use calculated completed projects
      hourlyRate: user.providerProfile?.hourlyRate || 0,
      location: user.providerProfile?.location || "Malaysia",
      bio: user.providerProfile?.bio || "Experienced ICT professional",
      availability: user.providerProfile?.availability || "Available",
      responseTime: `${user.providerProfile?.responseTime || 24} hours`,
      skills: user.providerProfile?.skills || [],
      specialties: user.providerProfile?.skills?.slice(0, 3) || [],
      languages: user.providerProfile?.languages || ["English"],
      verified: user.isVerified || false,
      topRated: user.providerProfile?.isFeatured || false,
      savedAt: user.savedAt,
      // Additional public-safe fields
      yearsExperience: user.providerProfile?.yearsExperience || 0,
      minimumProjectBudget: user.providerProfile?.minimumProjectBudget || null,
      maximumProjectBudget: user.providerProfile?.maximumProjectBudget || null,
      preferredProjectDuration:
        user.providerProfile?.preferredProjectDuration || null,
      workPreference: user.providerProfile?.workPreference || "remote",
      teamSize: user.providerProfile?.teamSize || 1,
      website: user.providerProfile?.website || null,
      portfolioLinks: user.providerProfile?.portfolioLinks || [],
      certificationsCount: user.providerProfile?.certifications?.length || 0,
      certifications: (user.providerProfile?.certifications || []).map(
        (cert) => ({
          id: cert.id,
          name: cert.name,
          issuer: cert.issuer,
          issuedDate: cert.issuedDate,
          verified: cert.verified,
        })
      ),
    }));

    return {
      providers: transformedProviders,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    };
  } catch (error) {
    console.error("Error getting saved providers:", error);
    throw new Error("Failed to get saved providers");
  }
}

// Get provider statistics
export async function getProviderStatistics(providerId) {
  try {
    const stats = await getProviderStats(providerId);
    return stats;
  } catch (error) {
    console.error("Error getting provider statistics:", error);
    throw new Error("Failed to get provider statistics");
  }
}

// Get filter options (categories, locations, etc.)
export async function getFilterOptions() {
  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();

    // Get unique skills for categories
    const skillsResult = await prisma.providerProfile.findMany({
      select: {
        skills: true,
      },
    });

    const allSkills = skillsResult.flatMap((profile) => profile.skills || []);
    const uniqueSkills = [...new Set(allSkills)];

    // Get unique locations
    const locationsResult = await prisma.providerProfile.findMany({
      select: {
        location: true,
      },
      where: {
        location: {
          not: null,
        },
      },
    });

    const uniqueLocations = [
      ...new Set(locationsResult.map((p) => p.location).filter(Boolean)),
    ];

    return {
      categories: [
        { value: "all", label: "All Categories" },
        ...uniqueSkills.slice(0, 10).map((skill) => ({
          value: skill.toLowerCase(),
          label: skill,
        })),
      ],
      locations: [
        { value: "all", label: "All Locations" },
        ...uniqueLocations.slice(0, 10).map((location) => ({
          value: location.toLowerCase(),
          label: location,
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
      categories: [
        { value: "all", label: "All Categories" },
        { value: "web", label: "Web Development" },
        { value: "mobile", label: "Mobile Development" },
        { value: "cloud", label: "Cloud Services" },
        { value: "data", label: "Data Analytics" },
        { value: "ui", label: "UI/UX Design" },
      ],
      locations: [
        { value: "all", label: "All Locations" },
        { value: "kuala lumpur", label: "Kuala Lumpur" },
        { value: "selangor", label: "Selangor" },
        { value: "penang", label: "Penang" },
        { value: "johor", label: "Johor" },
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
