import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

class CompanyProfileModel {
  // Get company profile by user ID
  static async getProfileByUserId(userId) {
    try {
      const profile = await prisma.customerProfile.findUnique({
        where: { userId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              phone: true,
              kycStatus: true,
              isVerified: true,
              createdAt: true,
              KycDocument: {
                select: {
                  id: true,
                  type: true,
                  fileUrl: true,
                  filename: true,
                  mimeType: true,
                  status: true,
                  reviewNotes: true,
                  reviewedBy: true,
                  uploadedAt: true,
                  reviewedAt: true,
                },
                orderBy: {
                  uploadedAt: "desc",
                },
              },
            },
          },
        },
      });

      return profile;
    } catch (error) {
      throw new Error(`Failed to get company profile: ${error.message}`);
    }
  }

  // Create new company profile
  static async createProfile(userId, profileData) {
    try {
      const profile = await prisma.customerProfile.create({
        data: {
          userId,
          ...profileData,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              phone: true,
              kycStatus: true,
              isVerified: true,
              createdAt: true,
              KycDocument: {
                select: {
                  id: true,
                  type: true,
                  fileUrl: true,
                  filename: true,
                  mimeType: true,
                  status: true,
                  reviewNotes: true,
                  reviewedBy: true,
                  uploadedAt: true,
                  reviewedAt: true,
                },
                orderBy: {
                  uploadedAt: "desc",
                },
              },
            },
          },
        },
      });

      return profile;
    } catch (error) {
      if (error.code === "P2002") {
        throw new Error("Company profile already exists for this user");
      }
      throw new Error(`Failed to create company profile: ${error.message}`);
    }
  }

  // Update company profile
  static async updateProfile(userId, updateData) {
    try {
      const profile = await prisma.customerProfile.update({
        where: { userId },
        data: {
          ...updateData,
          updatedAt: new Date(),
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              phone: true,
              kycStatus: true,
              isVerified: true,
              createdAt: true,
              KycDocument: {
                select: {
                  id: true,
                  type: true,
                  fileUrl: true,
                  filename: true,
                  mimeType: true,
                  status: true,
                  reviewNotes: true,
                  reviewedBy: true,
                  uploadedAt: true,
                  reviewedAt: true,
                },
                orderBy: {
                  uploadedAt: "desc",
                },
              },
            },
          },
        },
      });

      return profile;
    } catch (error) {
      if (error.code === "P2025") {
        throw new Error("Company profile not found");
      }
      throw new Error(`Failed to update company profile: ${error.message}`);
    }
  }

  // Check if profile exists
  static async profileExists(userId) {
    try {
      const profile = await prisma.customerProfile.findUnique({
        where: { userId },
        select: { id: true },
      });

      return !!profile;
    } catch (error) {
      throw new Error(`Failed to check profile existence: ${error.message}`);
    }
  }

  // Get profile completion percentage with suggestions
  static async getProfileCompletion(userId) {
    try {
      const profile = await prisma.customerProfile.findUnique({
        where: { userId },
        select: {
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
          mission: true,
          values: true,
          benefits: true,
          mediaGallery: true,
        },
      });

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          name: true,
          email: true,
          phone: true,
        },
      });

      if (!profile) {
        return {
          completion: 0,
          suggestions: [
            "Create your company profile",
            "Add company description",
            "Add industry",
            "Add location",
          ],
        };
      }

      // Count media gallery items
      const mediaGalleryCount = Array.isArray(profile.mediaGallery)
        ? profile.mediaGallery.length
        : 0;

      // Define fields with weights (total should be 100)
      // Covering ALL database fields
      const fieldWeights = {
        // Basic User Info (12 points)
        name: { weight: 4, label: "Company Name", value: user?.name },
        email: { weight: 4, label: "Email", value: user?.email },
        phone: { weight: 4, label: "Phone Number", value: user?.phone },

        // Company Identity (28 points)
        profileImageUrl: {
          weight: 6,
          label: "Profile Image",
          value: profile.profileImageUrl,
        },
        description: {
          weight: 9,
          label: "Company Description",
          value: profile.description,
          minLength: 50,
        },
        industry: { weight: 5, label: "Industry", value: profile.industry },
        location: { weight: 4, label: "Location", value: profile.location },
        website: { weight: 2, label: "Website", value: profile.website },
        languages: {
          weight: 2,
          label: "Languages",
          value: profile.languages,
          minCount: 1,
        },

        // Business Details (20 points)
        companySize: {
          weight: 4,
          label: "Company Size",
          value: profile.companySize,
        },
        employeeCount: {
          weight: 3,
          label: "Employee Count",
          value: profile.employeeCount,
        },
        establishedYear: {
          weight: 3,
          label: "Established Year",
          value: profile.establishedYear,
        },
        annualRevenue: {
          weight: 3,
          label: "Annual Revenue",
          value: profile.annualRevenue,
        },
        fundingStage: {
          weight: 3,
          label: "Funding Stage",
          value: profile.fundingStage,
        },
        socialLinks: {
          weight: 2,
          label: "Social Links",
          value: profile.socialLinks,
        },
        mediaGallery: {
          weight: 2,
          label: "Media Gallery",
          value: mediaGalleryCount,
          minCount: 1,
          isCount: true,
        },

        // Hiring Preferences (20 points)
        preferredContractTypes: {
          weight: 5,
          label: "Preferred Contract Types",
          value: profile.preferredContractTypes,
          minCount: 1,
        },
        averageBudgetRange: {
          weight: 4,
          label: "Average Budget Range",
          value: profile.averageBudgetRange,
        },
        remotePolicy: {
          weight: 4,
          label: "Remote Policy",
          value: profile.remotePolicy,
        },
        hiringFrequency: {
          weight: 4,
          label: "Hiring Frequency",
          value: profile.hiringFrequency,
        },
        categoriesHiringFor: {
          weight: 3,
          label: "Categories Hiring For",
          value: profile.categoriesHiringFor,
          minCount: 1,
        },

        // Branding & Culture (20 points)
        mission: {
          weight: 7,
          label: "Mission Statement",
          value: profile.mission,
        },
        values: {
          weight: 7,
          label: "Company Values",
          value: profile.values,
          minCount: 1,
        },
        benefits: { weight: 6, label: "Benefits", value: profile.benefits },
      };

      let totalScore = 0;
      const suggestions = [];

      // Calculate score and collect suggestions
      for (const [field, config] of Object.entries(fieldWeights)) {
        const { weight, label, value, minLength, minCount, isCount } = config;
        let isComplete = false;
        let suggestionMessage = null;

        if (value === null || value === undefined || value === "") {
          isComplete = false;
          suggestionMessage = `Add your ${label.toLowerCase()}`;
        } else if (isCount) {
          // Handle count-based fields (mediaGallery)
          const count = typeof value === "number" ? value : 0;
          if (minCount !== undefined) {
            isComplete = count >= minCount;
            if (!isComplete) {
              suggestionMessage = `Add at least ${minCount} ${label.toLowerCase()}${
                count > 0 ? ` (currently ${count})` : ""
              }`;
            }
          } else {
            isComplete = count > 0;
            if (!isComplete) {
              suggestionMessage = `Add your ${label.toLowerCase()}`;
            }
          }
        } else if (Array.isArray(value)) {
          const count = value.length;
          if (minCount !== undefined) {
            isComplete = count >= minCount;
            if (!isComplete) {
              suggestionMessage = `Add at least ${minCount} ${label.toLowerCase()}${
                count > 0 ? ` (currently ${count})` : ""
              }`;
            }
          } else {
            isComplete = count > 0;
            if (!isComplete) {
              suggestionMessage = `Add your ${label.toLowerCase()}`;
            }
          }
        } else if (typeof value === "string") {
          if (minLength !== undefined) {
            isComplete = value.trim().length >= minLength;
            if (!isComplete) {
              const currentLength = value.trim().length;
              suggestionMessage = `${label} should be at least ${minLength} characters${
                currentLength > 0 ? ` (currently ${currentLength})` : ""
              }`;
            }
          } else {
            isComplete = value.trim().length > 0;
            if (!isComplete) {
              suggestionMessage = `Add your ${label.toLowerCase()}`;
            }
          }
        } else if (typeof value === "boolean") {
          isComplete = value === true;
          if (!isComplete) {
            suggestionMessage = `Complete your ${label.toLowerCase()}`;
          }
        } else if (typeof value === "number") {
          isComplete = value !== null && value !== undefined && value > 0;
          if (!isComplete) {
            suggestionMessage = `Add your ${label.toLowerCase()}`;
          }
        } else if (typeof value === "object" && value !== null) {
          // Handle JSON fields like socialLinks, benefits
          isComplete = Object.keys(value).length > 0;
          if (!isComplete) {
            suggestionMessage = `Add your ${label.toLowerCase()}`;
          }
          } else {
          isComplete = value !== null && value !== undefined;
          if (!isComplete) {
            suggestionMessage = `Add your ${label.toLowerCase()}`;
          }
        }

        if (isComplete) {
          totalScore += weight;
        } else if (suggestionMessage) {
          suggestions.push(suggestionMessage);
          }
        }

      // Sort suggestions by priority (missing core fields first)
      const priorityOrder = [
        "company description",
        "industry",
        "location",
        "company size",
        "profile image",
        "preferred contract types",
        "average budget range",
        "remote policy",
        "hiring frequency",
        "categories hiring for",
        "mission statement",
        "company values",
        "employee count",
        "established year",
        "annual revenue",
        "funding stage",
        "languages",
        "social links",
        "website",
        "phone number",
        "media gallery",
        "benefits",
      ];

      suggestions.sort((a, b) => {
        const aPriority = priorityOrder.findIndex((p) =>
          a.toLowerCase().includes(p)
        );
        const bPriority = priorityOrder.findIndex((p) =>
          b.toLowerCase().includes(p)
        );
        if (aPriority === -1 && bPriority === -1) return 0;
        if (aPriority === -1) return 1;
        if (bPriority === -1) return -1;
        return aPriority - bPriority;
      });

      // Limit to top 8 suggestions
      const topSuggestions = suggestions.slice(0, 8);

      return {
        completion: Math.min(100, Math.round(totalScore)),
        suggestions: topSuggestions,
        totalFields: Object.keys(fieldWeights).length,
        completedFields:
          Object.keys(fieldWeights).length - topSuggestions.length,
      };
    } catch (error) {
      throw new Error(
        `Failed to calculate profile completion: ${error.message}`
      );
    }
  }

  // Update profile completion percentage
  static async updateProfileCompletion(userId) {
    try {
      const completionData = await this.getProfileCompletion(userId);
      
      await prisma.customerProfile.update({
        where: { userId },
        data: { completion: completionData.completion },
      });

      return completionData.completion;
    } catch (error) {
      throw new Error(`Failed to update profile completion: ${error.message}`);
    }
  }

  // Get all company profiles (for admin or public listing)
  static async getAllProfiles(filters = {}) {
    try {
      const where = {};

      // Apply filters
      if (filters.industry) {
        where.industry = { contains: filters.industry, mode: "insensitive" };
      }

      if (filters.location) {
        where.location = { contains: filters.location, mode: "insensitive" };
      }

      if (filters.companySize) {
        where.companySize = filters.companySize;
      }

      if (filters.hiringFrequency) {
        where.hiringFrequency = filters.hiringFrequency;
      }

      const profiles = await prisma.customerProfile.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              phone: true,
              kycStatus: true,
              isVerified: true,
              createdAt: true,
              KycDocument: {
                select: {
                  id: true,
                  type: true,
                  fileUrl: true,
                  filename: true,
                  mimeType: true,
                  status: true,
                  reviewNotes: true,
                  reviewedBy: true,
                  uploadedAt: true,
                  reviewedAt: true,
                },
                orderBy: {
                  uploadedAt: "desc",
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: filters.limit || 50,
        skip: filters.skip || 0,
      });

      return profiles;
    } catch (error) {
      throw new Error(`Failed to get company profiles: ${error.message}`);
    }
  }

  // Search company profiles
  static async searchProfiles(searchTerm, filters = {}) {
    try {
      const where = {
        OR: [
          { description: { contains: searchTerm, mode: "insensitive" } },
          { industry: { contains: searchTerm, mode: "insensitive" } },
          { location: { contains: searchTerm, mode: "insensitive" } },
          { mission: { contains: searchTerm, mode: "insensitive" } },
        ],
      };

      // Apply additional filters
      if (filters.industry) {
        where.industry = { contains: filters.industry, mode: "insensitive" };
      }

      if (filters.location) {
        where.location = { contains: filters.location, mode: "insensitive" };
      }

      if (filters.companySize) {
        where.companySize = filters.companySize;
      }

      const profiles = await prisma.customerProfile.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              phone: true,
              kycStatus: true,
              isVerified: true,
              createdAt: true,
              KycDocument: {
                select: {
                  id: true,
                  type: true,
                  fileUrl: true,
                  filename: true,
                  mimeType: true,
                  status: true,
                  reviewNotes: true,
                  reviewedBy: true,
                  uploadedAt: true,
                  reviewedAt: true,
                },
                orderBy: {
                  uploadedAt: "desc",
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: filters.limit || 50,
        skip: filters.skip || 0,
      });

      return profiles;
    } catch (error) {
      throw new Error(`Failed to search company profiles: ${error.message}`);
    }
  }

  // Get user with enhanced data including KYC documents
  static async getUserWithKycData(userId) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          kycStatus: true,
          isVerified: true,
          createdAt: true,
          KycDocument: {
            select: {
              id: true,
              type: true,
              fileUrl: true,
              filename: true,
              mimeType: true,
              status: true,
              reviewNotes: true,
              reviewedBy: true,
              uploadedAt: true,
              reviewedAt: true,
            },
            orderBy: {
              uploadedAt: "desc",
            },
          },
        },
      });

      return user;
    } catch (error) {
      throw new Error(`Failed to get user with KYC data: ${error.message}`);
    }
  }
}

export default CompanyProfileModel;
