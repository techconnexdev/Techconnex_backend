
import ProviderProfileModel from "./model.js";
import { ProviderProfileDto, ProviderProfileResponseDto } from "./dto.js";
import { updateProviderInRecommendationsCache } from "../../company/find-providers/recommended-service.js";
import { invalidateRecommendationsCache } from "../../provider/opportunities/recommended-service.js";
import {
  profilePayloadTouchesPricing,
  upsertSettingsPreferredCurrency,
  syncProviderProfilePricingFx,
} from "./pricing-fx.js";

import { prisma } from "../../../utils/prisma.js";
class ProviderProfileService {
  // Get provider profile by user ID
  static async getProfile(userId) {
    try {
      const profile = await ProviderProfileModel.getProfileByUserId(userId);
      
      if (!profile) {
        throw new Error("Provider profile not found");
      }

      const completionData = await ProviderProfileModel.getProfileCompletion(userId);

      const settingsRow = await prisma.settings.findUnique({
        where: { userId },
        select: { preferredCurrency: true },
      });

      const responseDto = new ProviderProfileResponseDto({
        ...profile,
        completion: completionData.completion,
        preferredCurrency: settingsRow?.preferredCurrency || "MYR",
      });

      return responseDto.toResponse();
    } catch (error) {
      throw new Error(`Failed to get provider profile: ${error.message}`);
    }
  }

  // Create new provider profile
  static async createProfile(userId, profileData) {
    try {
      // Validate input data
      const dto = new ProviderProfileDto(profileData);
      dto.validate();

      // Check if profile already exists
      const exists = await ProviderProfileModel.profileExists(userId);
      if (exists) {
        throw new Error("Provider profile already exists for this user");
      }

      const createData = dto.toUpdateData();
      const profile = await ProviderProfileModel.createProfile(userId, createData);

      if (
        profilePayloadTouchesPricing(profileData) ||
        profileData.preferredCurrency != null
      ) {
        if (
          profileData.preferredCurrency != null &&
          String(profileData.preferredCurrency).trim() !== ""
        ) {
          await upsertSettingsPreferredCurrency(
            userId,
            profileData.preferredCurrency,
          );
          invalidateRecommendationsCache(userId);
        }
        await syncProviderProfilePricingFx(userId);
      }

      const profileFresh = await ProviderProfileModel.getProfileByUserId(userId);
      const settingsRow = await prisma.settings.findUnique({
        where: { userId },
        select: { preferredCurrency: true },
      });

      // Update completion percentage
      const completion = await ProviderProfileModel.updateProfileCompletion(userId);

      const responseDto = new ProviderProfileResponseDto({
        ...profileFresh,
        completion,
        preferredCurrency: settingsRow?.preferredCurrency || "MYR",
      });

      return responseDto.toResponse();
    } catch (error) {
      throw new Error(`Failed to create provider profile: ${error.message}`);
    }
  }

  // Update provider profile
  static async updateProfile(userId, profileData) {
    try {
      // Check if profile exists
      const exists = await ProviderProfileModel.profileExists(userId);
      if (!exists) {
        throw new Error("Provider profile not found");
      }

      // If only profileImageUrl is provided, update directly without full validation
      if (Object.keys(profileData).length === 1 && profileData.profileImageUrl) {
        const profile = await ProviderProfileModel.updateProfile(userId, {
          profileImageUrl: profileData.profileImageUrl,
        });
        updateProviderInRecommendationsCache(userId, {
          avatar: profile.profileImageUrl,
        });
        const settingsRow = await prisma.settings.findUnique({
          where: { userId },
          select: { preferredCurrency: true },
        });
        const completionNum = await ProviderProfileModel.updateProfileCompletion(
          userId,
        );
        return new ProviderProfileResponseDto({
          ...profile,
          completion: completionNum,
          preferredCurrency: settingsRow?.preferredCurrency || "MYR",
        }).toResponse();
      }

      if (
        profileData.preferredCurrency != null &&
        String(profileData.preferredCurrency).trim() !== ""
      ) {
        await upsertSettingsPreferredCurrency(
          userId,
          profileData.preferredCurrency,
        );
        invalidateRecommendationsCache(userId);
      }

      // Validate input data for full updates
      const dto = new ProviderProfileDto(profileData);
      dto.validate();

      // Update profile
      const profile = await ProviderProfileModel.updateProfile(userId, dto.toUpdateData());

      if (profilePayloadTouchesPricing(profileData)) {
        await syncProviderProfilePricingFx(userId);
      }

      const profileFresh = await ProviderProfileModel.getProfileByUserId(userId);
      const settingsRow = await prisma.settings.findUnique({
        where: { userId },
        select: { preferredCurrency: true },
      });

      // Patch provider in recommendations cache (keeps AI explanations, updates mutable fields)
      updateProviderInRecommendationsCache(userId, {
        availability: profileFresh.availability,
        hourlyRate: profileFresh.hourlyRate,
        location: profileFresh.location,
        bio: profileFresh.bio,
        skills: profileFresh.skills,
        yearsExperience: profileFresh.yearsExperience,
        minimumProjectBudget: profileFresh.minimumProjectBudget,
        maximumProjectBudget: profileFresh.maximumProjectBudget,
        preferredProjectDuration: profileFresh.preferredProjectDuration,
        workPreference: profileFresh.workPreference,
        successRate: profileFresh.successRate,
        avatar: profileFresh.profileImageUrl,
      });

      // Update completion percentage
      const completion = await ProviderProfileModel.updateProfileCompletion(userId);

      return new ProviderProfileResponseDto({
        ...profileFresh,
        completion,
        preferredCurrency: settingsRow?.preferredCurrency || "MYR",
      }).toResponse();
    } catch (error) {
      throw new Error(`Failed to update provider profile: ${error.message}`);
    }
  }

  // Upsert provider profile (create or update)
  static async upsertProfile(userId, profileData) {
    try {
      // Extract portfolioUrls, phone, email, preferredCurrency (currency lives on Settings)
      const { portfolioUrls, phone, email, preferredCurrency, ...restProfileData } =
        profileData;

      if (
        preferredCurrency != null &&
        String(preferredCurrency).trim() !== ""
      ) {
        await upsertSettingsPreferredCurrency(userId, preferredCurrency);
        invalidateRecommendationsCache(userId);
      }

      // Validate input data (partial validation for upsert)
      const dto = new ProviderProfileDto(restProfileData);
      dto.validatePartial();

      // Upsert profile (portfolioUrls is handled separately via portfolios relation if needed)
      let profile = await ProviderProfileModel.upsertProfile(
        userId,
        dto.toUpdateData(),
      );

      if (profilePayloadTouchesPricing(profileData)) {
        await syncProviderProfilePricingFx(userId);
        profile = await ProviderProfileModel.getProfileByUserId(userId);
      }


      if (email != null && String(email).trim() !== "") {
        const updatedUser = await ProviderProfileModel.updateUserEmail(userId, email);
        if (updatedUser && profile.user) {
          profile.user = { ...profile.user, email: updatedUser.email };
        }
      }
      if (phone != null && String(phone).trim() !== "") {
        const updatedUser = await ProviderProfileModel.updateUserPhone(userId, phone);
        if (updatedUser && profile.user) {
          profile.user = {
            ...profile.user,
            phone: updatedUser.phone,
            phoneVerified: updatedUser.phoneVerified,
          };
        }
      }

      const settingsRow = await prisma.settings.findUnique({
        where: { userId },
        select: { preferredCurrency: true },
      });

      // Patch provider in recommendations cache (keeps AI explanations, updates mutable fields)
      updateProviderInRecommendationsCache(userId, {
        availability: profile.availability,
        hourlyRate: profile.hourlyRate,
        location: profile.location,
        bio: profile.bio,
        skills: profile.skills,
        yearsExperience: profile.yearsExperience,
        minimumProjectBudget: profile.minimumProjectBudget,
        maximumProjectBudget: profile.maximumProjectBudget,
        preferredProjectDuration: profile.preferredProjectDuration,
        workPreference: profile.workPreference,
        successRate: profile.successRate,
        avatar: profile.profileImageUrl,
      });

      // Update completion percentage
      const completion = await ProviderProfileModel.updateProfileCompletion(userId);

      return new ProviderProfileResponseDto({
        ...profile,
        completion,
        preferredCurrency: settingsRow?.preferredCurrency || "MYR",
      }).toResponse();
    } catch (error) {
      throw new Error(`Failed to upsert provider profile: ${error.message}`);
    }
  }

  // Get profile statistics
  static async getProfileStats(userId) {
    try {
      const stats = await ProviderProfileModel.getProfileStats(userId);
      return stats;
    } catch (error) {
      throw new Error(`Failed to get provider profile stats: ${error.message}`);
    }
  }

  // Get profile completion with suggestions
  static async getProfileCompletion(userId) {
    try {
      const completionData = await ProviderProfileModel.getProfileCompletion(userId);
      return completionData;
    } catch (error) {
      throw new Error(`Failed to get provider profile completion: ${error.message}`);
    }
  }

  // Get completed projects for portfolio (platform projects)
  static async getCompletedProjects(userId) {
    try {
      // Import PrismaClient and create instance
      const { PrismaClient } = await import("@prisma/client");
const projects = await prisma.project.findMany({
        where: {
          providerId: userId,
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
        const approvedPrice = project.milestones.reduce((sum, m) => sum + (m.amount || 0), 0);
        
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
          completedDate: project.updatedAt ? new Date(project.updatedAt).toISOString().split('T')[0] : null,
          approvedPrice,
          image: null, // Projects don't have images, but we can use placeholder or category icon
        };
      });

      await prisma.$disconnect();
      return portfolioProjects;
    } catch (error) {
      throw new Error(`Failed to get completed projects: ${error.message}`);
    }
  }

  // Get external portfolio items (ProjectPortfolio)
  static async getPortfolioItems(userId) {
    try {
      const { PrismaClient } = await import("@prisma/client");
// First get the provider profile to get profileId
      const profile = await prisma.providerProfile.findUnique({
        where: { userId },
        select: { id: true },
      });

      if (!profile) {
        throw new Error("Provider profile not found");
      }

      const portfolioItems = await prisma.projectPortfolio.findMany({
        where: { profileId: profile.id },
        orderBy: { date: "desc" },
      });

      await prisma.$disconnect();
      return portfolioItems;
    } catch (error) {
      throw new Error(`Failed to get portfolio items: ${error.message}`);
    }
  }

  // Create portfolio item
  static async createPortfolioItem(userId, portfolioData) {
    try {
      const { PrismaClient } = await import("@prisma/client");
// Validate required fields
      if (!portfolioData.title || !portfolioData.description || !portfolioData.date) {
        throw new Error("Title, description, and date are required");
      }

      // Get the provider profile to get profileId
      const profile = await prisma.providerProfile.findUnique({
        where: { userId },
        select: { id: true },
      });

      if (!profile) {
        throw new Error("Provider profile not found");
      }

      const portfolioItem = await prisma.projectPortfolio.create({
        data: {
          profileId: profile.id,
          title: portfolioData.title,
          description: portfolioData.description,
          techStack: portfolioData.techStack || [],
          client: portfolioData.client || null,
          date: new Date(portfolioData.date),
          imageUrl: portfolioData.imageUrl || null,
          externalUrl: portfolioData.externalUrl || null,
        },
      });

      // Update profile completion
      await ProviderProfileModel.updateProfileCompletion(userId);

      await prisma.$disconnect();
      return portfolioItem;
    } catch (error) {
      throw new Error(`Failed to create portfolio item: ${error.message}`);
    }
  }

  // Update portfolio item
  static async updatePortfolioItem(userId, portfolioId, portfolioData) {
    try {
      const { PrismaClient } = await import("@prisma/client");
// Get the provider profile to verify ownership
      const profile = await prisma.providerProfile.findUnique({
        where: { userId },
        select: { id: true },
      });

      if (!profile) {
        throw new Error("Provider profile not found");
      }

      // Verify the portfolio item belongs to this provider
      const existingItem = await prisma.projectPortfolio.findUnique({
        where: { id: portfolioId },
        select: { profileId: true },
      });

      if (!existingItem || existingItem.profileId !== profile.id) {
        throw new Error("Portfolio item not found or access denied");
      }

      const updateData = {};
      if (portfolioData.title !== undefined) updateData.title = portfolioData.title;
      if (portfolioData.description !== undefined) updateData.description = portfolioData.description;
      if (portfolioData.techStack !== undefined) updateData.techStack = portfolioData.techStack;
      if (portfolioData.client !== undefined) updateData.client = portfolioData.client;
      if (portfolioData.date !== undefined) updateData.date = new Date(portfolioData.date);
      if (portfolioData.imageUrl !== undefined) updateData.imageUrl = portfolioData.imageUrl;
      if (portfolioData.externalUrl !== undefined) updateData.externalUrl = portfolioData.externalUrl;

      const portfolioItem = await prisma.projectPortfolio.update({
        where: { id: portfolioId },
        data: updateData,
      });

      // Update profile completion
      await ProviderProfileModel.updateProfileCompletion(userId);

      await prisma.$disconnect();
      return portfolioItem;
    } catch (error) {
      throw new Error(`Failed to update portfolio item: ${error.message}`);
    }
  }

  // Delete portfolio item
  static async deletePortfolioItem(userId, portfolioId) {
    try {
      const { PrismaClient } = await import("@prisma/client");
// Get the provider profile to verify ownership
      const profile = await prisma.providerProfile.findUnique({
        where: { userId },
        select: { id: true },
      });

      if (!profile) {
        throw new Error("Provider profile not found");
      }

      // Verify the portfolio item belongs to this provider
      const existingItem = await prisma.projectPortfolio.findUnique({
        where: { id: portfolioId },
        select: { profileId: true },
      });

      if (!existingItem || existingItem.profileId !== profile.id) {
        throw new Error("Portfolio item not found or access denied");
      }

      await prisma.projectPortfolio.delete({
        where: { id: portfolioId },
      });

      // Update profile completion
      await ProviderProfileModel.updateProfileCompletion(userId);

      await prisma.$disconnect();
      return { success: true };
    } catch (error) {
      throw new Error(`Failed to delete portfolio item: ${error.message}`);
    }
  }

}

export default ProviderProfileService;