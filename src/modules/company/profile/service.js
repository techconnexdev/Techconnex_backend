import CompanyProfileModel from "./model.js";
import { CompanyProfileDto, CompanyProfileUpdateDto, CompanyProfileResponseDto } from "./dto.js";

class CompanyProfileService {
  // Get company profile by user ID
  static async getProfile(userId) {
    try {
      const profile = await CompanyProfileModel.getProfileByUserId(userId);
      
      if (!profile) {
        throw new Error("Company profile not found");
      }

      // Calculate completion percentage
      const completion = await CompanyProfileModel.getProfileCompletion(userId);
      
      // Format response using DTO
      const responseDto = new CompanyProfileResponseDto({
        ...profile,
        completion,
      });
      
      return responseDto.toResponse();
    } catch (error) {
      throw new Error(`Failed to get company profile: ${error.message}`);
    }
  }

  // Create new company profile
  static async createProfile(userId, profileData) {
    try {
      // Validate input data
      const dto = new CompanyProfileDto(profileData);
      dto.validate();

      // Check if profile already exists
      const exists = await CompanyProfileModel.profileExists(userId);
      if (exists) {
        throw new Error("Company profile already exists for this user");
      }

      // Create profile
      const profile = await CompanyProfileModel.createProfile(userId, dto.toUpdateData());

      // Update completion percentage
      const completion = await CompanyProfileModel.updateProfileCompletion(userId);

      return {
        ...profile,
        completion,
      };
    } catch (error) {
      throw new Error(`Failed to create company profile: ${error.message}`);
    }
  }

  // Update company profile
  static async updateProfile(userId, updateData) {
    try {
      // If only profileImageUrl is provided, update directly without validation
      if (Object.keys(updateData).length === 1 && updateData.profileImageUrl) {
        const profile = await CompanyProfileModel.updateProfile(userId, {
          profileImageUrl: updateData.profileImageUrl,
        });
        const completion = await CompanyProfileModel.getProfileCompletion(userId);
        const responseDto = new CompanyProfileResponseDto({
          ...profile,
          completion,
        });
        return responseDto.toResponse();
      }

      // Validate input data for full updates
      const dto = new CompanyProfileUpdateDto(updateData);
      dto.validate();

      // Additional validation: Check mediaGallery limit if it's being updated
      if (updateData.mediaGallery !== undefined && Array.isArray(updateData.mediaGallery)) {
        if (updateData.mediaGallery.length > 10) {
          throw new Error("Media gallery cannot contain more than 10 images");
        }
      }

      // Check if profile exists
      const exists = await CompanyProfileModel.profileExists(userId);
      if (!exists) {
        throw new Error("Company profile not found");
      }

      // Update profile
      const profile = await CompanyProfileModel.updateProfile(userId, dto.toUpdateData());

      // Update completion percentage
      const completion = await CompanyProfileModel.updateProfileCompletion(userId);
      
      // Format response using DTO to ensure consistent structure
      const responseDto = new CompanyProfileResponseDto({
        ...profile,
        completion,
      });
      
      return responseDto.toResponse();
    } catch (error) {
      throw new Error(`Failed to update company profile: ${error.message}`);
    }
  }

  // Create or update company profile (upsert)
  static async upsertProfile(userId, profileData) {
    try {
      // Check if profile exists
      const exists = await CompanyProfileModel.profileExists(userId);
      
      if (exists) {
        return await this.updateProfile(userId, profileData);
      } else {
        return await this.createProfile(userId, profileData);
      }
    } catch (error) {
      throw new Error(`Failed to upsert company profile: ${error.message}`);
    }
  }

  // Get profile completion percentage with suggestions
  static async getProfileCompletion(userId) {
    try {
      const completionData = await CompanyProfileModel.getProfileCompletion(userId);
      return completionData;
    } catch (error) {
      throw new Error(`Failed to get profile completion: ${error.message}`);
    }
  }

  // Get all company profiles (for admin or public listing)
  static async getAllProfiles(filters = {}) {
    try {
      const profiles = await CompanyProfileModel.getAllProfiles(filters);
      
      // Add completion percentage to each profile
      const profilesWithCompletion = await Promise.all(
        profiles.map(async (profile) => {
          const completion = await CompanyProfileModel.getProfileCompletion(profile.userId);
          return {
            ...profile,
            completion,
          };
        })
      );

      return profilesWithCompletion;
    } catch (error) {
      throw new Error(`Failed to get all company profiles: ${error.message}`);
    }
  }

  // Search company profiles
  static async searchProfiles(searchTerm, filters = {}) {
    try {
      if (!searchTerm || searchTerm.trim().length < 2) {
        throw new Error("Search term must be at least 2 characters long");
      }

      const profiles = await CompanyProfileModel.searchProfiles(searchTerm.trim(), filters);
      
      // Add completion percentage to each profile
      const profilesWithCompletion = await Promise.all(
        profiles.map(async (profile) => {
          const completion = await CompanyProfileModel.getProfileCompletion(profile.userId);
          return {
            ...profile,
            completion,
          };
        })
      );

      return profilesWithCompletion;
    } catch (error) {
      throw new Error(`Failed to search company profiles: ${error.message}`);
    }
  }

  // Get profile statistics
  static async getProfileStats(userId) {
    try {
      const profile = await CompanyProfileModel.getProfileByUserId(userId);
      
      if (!profile) {
        throw new Error("Company profile not found");
      }

      // Get additional stats from related models
      const stats = await CompanyProfileModel.prisma.$transaction(async (tx) => {
        // Use projectsPosted from database (automatically updated when service requests are created)
        const projectsPosted = profile.projectsPosted ?? 0;

        const activeProjects = await tx.project.count({
          where: {
            customerId: userId,
            status: 'IN_PROGRESS',
          },
        });

        const completedProjects = await tx.project.count({
          where: {
            customerId: userId,
            status: 'COMPLETED',
          },
        });

        const totalSpend = await tx.payment.aggregate({
          where: {
            project: {
              customerId: userId,
            },
            status: 'RELEASED',
          },
          _sum: {
            amount: true,
          },
        });

        return {
          projectsPosted,
          activeProjects,
          completedProjects,
          totalSpend: totalSpend._sum.amount || 0,
        };
      });

      return {
        ...profile,
        stats,
      };
    } catch (error) {
      throw new Error(`Failed to get profile statistics: ${error.message}`);
    }
  }

  // Validate profile data before saving
  static validateProfileData(profileData, isUpdate = false) {
    try {
      if (isUpdate) {
        const dto = new CompanyProfileUpdateDto(profileData);
        dto.validate();
        return dto.toUpdateData();
      } else {
        const dto = new CompanyProfileDto(profileData);
        dto.validate();
        return dto.toUpdateData();
      }
    } catch (error) {
      throw new Error(`Profile validation failed: ${error.message}`);
    }
  }

  // Get profile by ID (for public viewing)
  static async getPublicProfile(profileId) {
    try {
      const profile = await CompanyProfileModel.prisma.customerProfile.findUnique({
        where: { id: profileId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              isVerified: true,
              createdAt: true,
            },
          },
        },
      });

      if (!profile) {
        throw new Error("Company profile not found");
      }

      // Calculate completion percentage
      const completion = await CompanyProfileModel.getProfileCompletion(profile.userId);

      return {
        ...profile,
        completion,
      };
    } catch (error) {
      throw new Error(`Failed to get public profile: ${error.message}`);
    }
  }

  // Get KYC documents for a user
  static async getKycDocuments(userId) {
    try {
      const documents = await CompanyProfileModel.getKycDocuments(userId);
      return { documents };
    } catch (error) {
      throw new Error(`Failed to get KYC documents: ${error.message}`);
    }
  }

  // Get KYC document by ID
  static async getKycDocumentById(documentId) {
    try {
      const document = await CompanyProfileModel.getKycDocumentById(documentId);
      
      if (!document) {
        throw new Error("KYC document not found");
      }

      return { document };
    } catch (error) {
      throw new Error(`Failed to get KYC document: ${error.message}`);
    }
  }

  // Get user with enhanced KYC data
  static async getUserWithKycData(userId) {
    try {
      const user = await CompanyProfileModel.getUserWithKycData(userId);
      
      if (!user) {
        throw new Error("User not found");
      }

      return { user };
    } catch (error) {
      throw new Error(`Failed to get user with KYC data: ${error.message}`);
    }
  }

  // Get comprehensive profile data including all user and KYC information
  static async getComprehensiveProfile(userId) {
    try {
      const profile = await CompanyProfileModel.getProfileByUserId(userId);
      
      if (!profile) {
        throw new Error("Company profile not found");
      }

      // Calculate completion percentage
      const completion = await CompanyProfileModel.getProfileCompletion(userId);
      
      // Get additional stats
      const stats = await this.getProfileStats(userId);

      return {
        ...profile,
        completion,
        stats: stats.stats,
      };
    } catch (error) {
      throw new Error(`Failed to get comprehensive profile: ${error.message}`);
    }
  }
}

export default CompanyProfileService;
