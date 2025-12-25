import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

class ProviderProfileModel {
  // Get provider profile by user ID
  static async getProfileByUserId(userId) {
    try {
      const profile = await prisma.providerProfile.findUnique({
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
          certifications: {
            orderBy: {
              issuedDate: "desc",
            },
          },
          portfolios: {
            orderBy: {
              date: "desc",
            },
          },
          performance: true,
        },
      });

      return profile;
    } catch (error) {
      throw new Error(`Failed to get provider profile: ${error.message}`);
    }
  }

  // Create new provider profile
  static async createProfile(userId, profileData) {
    try {
      const profile = await prisma.providerProfile.create({
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
            },
          },
        },
      });

      return profile;
    } catch (error) {
      throw new Error(`Failed to create provider profile: ${error.message}`);
    }
  }

  // Update provider profile
  static async updateProfile(userId, profileData) {
    try {
      const profile = await prisma.providerProfile.update({
        where: { userId },
        data: profileData,
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
            },
          },
        },
      });

      return profile;
    } catch (error) {
      throw new Error(`Failed to update provider profile: ${error.message}`);
    }
  }

  // Upsert provider profile (create or update)
  static async upsertProfile(userId, profileData) {
    try {
      const profile = await prisma.providerProfile.upsert({
        where: { userId },
        update: profileData,
        create: {
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
            },
          },
        },
      });

      return profile;
    } catch (error) {
      throw new Error(`Failed to upsert provider profile: ${error.message}`);
    }
  }

  // Check if profile exists
  static async profileExists(userId) {
    try {
      const profile = await prisma.providerProfile.findUnique({
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
      const profile = await prisma.providerProfile.findUnique({
        where: { userId },
        select: {
          bio: true,
          location: true,
          hourlyRate: true,
          availability: true,
          languages: true,
          website: true,
          // portfolioLinks: true,
          profileImageUrl: true,
          skills: true,
          yearsExperience: true,
          minimumProjectBudget: true,
          maximumProjectBudget: true,
          preferredProjectDuration: true,
          workPreference: true,
          teamSize: true,
          certifications: {
            select: {
              id: true,
              name: true,
              issuer: true,
              issuedDate: true,
              serialNumber: true,
              sourceUrl: true,
            },
          },
          portfolios: {
            select: {
              id: true,
              title: true,
              description: true,
              techStack: true,
              client: true,
              date: true,
              imageUrl: true,
              externalUrl: true,
            },
          },
          performance: {
            select: {
              id: true,
            },
          },
        },
      });

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          name: true,
          email: true,
          phone: true,
          resume: {
            select: {
              id: true,
              fileUrl: true,
              description: true,
            },
          },
        },
      });

      if (!profile) {
        return {
          completion: 0,
          suggestions: [
            "Create your provider profile",
            "Add your bio",
            "Add your location",
            "Add your skills",
          ],
        };
      }

      // Count certifications with complete data
      const completeCertifications =
        profile.certifications?.filter(
          (cert) => cert.name && cert.issuer && cert.issuedDate
        ).length || 0;

      // Count portfolios with complete data
      const completePortfolios =
        profile.portfolios?.filter(
          (portfolio) =>
            portfolio.title && portfolio.description && portfolio.date
        ).length || 0;

      // Define fields with weights (total should be 100)
      // Reorganized to cover ALL database fields
      const fieldWeights = {
        // Basic User Info (15 points)
        name: { weight: 4, label: "Full Name", value: user?.name },
        email: { weight: 4, label: "Email", value: user?.email },
        phone: { weight: 4, label: "Phone Number", value: user?.phone },
        resume: { weight: 3, label: "Resume/CV", value: user?.resume?.fileUrl },

        // Profile Identity (25 points)
        profileImageUrl: {
          weight: 5,
          label: "Profile Image",
          value: profile.profileImageUrl,
        },
        bio: {
          weight: 8,
          label: "Bio/Description",
          value: profile.bio,
          minLength: 50,
        },
        location: { weight: 5, label: "Location", value: profile.location },
        availability: {
          weight: 4,
          label: "Availability Status",
          value: profile.availability,
        },
        languages: {
          weight: 3,
          label: "Languages",
          value: profile.languages,
          minCount: 1,
        },

        // Skills & Expertise (15 points)
        skills: {
          weight: 10,
          label: "Skills",
          value: profile.skills,
          minCount: 3,
        },
        yearsExperience: {
          weight: 5,
          label: "Years of Experience",
          value: profile.yearsExperience,
        },

        // Professional Details (20 points)
        hourlyRate: {
          weight: 5,
          label: "Hourly Rate",
          value: profile.hourlyRate,
        },
        minimumProjectBudget: {
          weight: 4,
          label: "Minimum Project Budget",
          value: profile.minimumProjectBudget,
        },
        maximumProjectBudget: {
          weight: 4,
          label: "Maximum Project Budget",
          value: profile.maximumProjectBudget,
        },
        preferredProjectDuration: {
          weight: 4,
          label: "Preferred Project Duration",
          value: profile.preferredProjectDuration,
        },
        workPreference: {
          weight: 3,
          label: "Work Preference",
          value: profile.workPreference,
        },

        // Team & Additional Info (10 points)
        teamSize: { weight: 3, label: "Team Size", value: profile.teamSize },
        website: { weight: 4, label: "Website", value: profile.website },
        portfolioLinks: {
          weight: 3,
          label: "Portfolio Links",
          value: profile.portfolioLinks,
          minCount: 1,
        },

        // Credentials & Portfolio (15 points)
        certifications: {
          weight: 8,
          label: "Certifications",
          value: completeCertifications,
          minCount: 1,
          isCount: true,
        },
        portfolios: {
          weight: 7,
          label: "Portfolio Projects",
          value: completePortfolios,
          minCount: 1,
          isCount: true,
        },
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
          // Handle count-based fields (certifications, portfolios)
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
        "bio",
        "location",
        "skills",
        "profile image",
        "years of experience",
        "hourly rate",
        "languages",
        "certifications",
        "portfolio projects",
        "resume",
        "phone number",
        "minimum project budget",
        "maximum project budget",
        "preferred project duration",
        "work preference",
        "team size",
        "website",
        "portfolio links",
        "availability status",
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

      // Limit to top 8 suggestions to show more actionable items
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

  // Update profile completion
  static async updateProfileCompletion(userId) {
    try {
      const completionData = await this.getProfileCompletion(userId);
      
      await prisma.providerProfile.update({
        where: { userId },
        data: { completion: completionData.completion },
      });

      return completionData.completion;
    } catch (error) {
      throw new Error(`Failed to update profile completion: ${error.message}`);
    }
  }

  // Get profile statistics
  static async getProfileStats(userId) {
    try {
      const profile = await prisma.providerProfile.findUnique({
        where: { userId },
        select: {
          rating: true,
          totalReviews: true,
          totalProjects: true,
          totalEarnings: true,
          viewsCount: true,
          successRate: true,
          responseTime: true,
          completion: true,
        },
      });

      return (
        profile || {
        rating: 0,
        totalReviews: 0,
        totalProjects: 0,
        totalEarnings: 0,
        viewsCount: 0,
        successRate: 0,
        responseTime: 0,
        completion: 0,
        }
      );
    } catch (error) {
      throw new Error(`Failed to get profile stats: ${error.message}`);
    }
  }

}

export default ProviderProfileModel;
