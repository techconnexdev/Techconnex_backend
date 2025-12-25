import ProviderProfileService from "./service.js";
import { ProviderProfileDto } from "./dto.js";

class ProviderProfileController {
  // GET /api/provider/profile - Get provider profile
  static async getProfile(req, res) {
    try {
      const userId = req.user.userId;
      const profile = await ProviderProfileService.getProfile(userId);
      
      res.json({
        success: true,
        message: "Provider profile retrieved successfully",
        data: profile,
      });
    } catch (error) {
      console.error("Error in getProfile:", error);
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  // POST /api/provider/profile - Create provider profile
  static async createProfile(req, res) {
    try {
      const userId = req.user.userId;
      const profileData = req.body;
      
      const profile = await ProviderProfileService.createProfile(userId, profileData);
      
      res.json({
        success: true,
        message: "Provider profile created successfully",
        data: profile,
      });
    } catch (error) {
      console.error("Error in createProfile:", error);
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  // PUT /api/provider/profile - Update provider profile
  static async updateProfile(req, res) {
    try {
      const userId = req.user.userId;
      const profileData = req.body;
      
      const profile = await ProviderProfileService.updateProfile(userId, profileData);
      
      res.json({
        success: true,
        message: "Provider profile updated successfully",
        data: profile,
      });
    } catch (error) {
      console.error("Error in updateProfile:", error);
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  // PATCH /api/provider/profile - Upsert provider profile
  static async upsertProfile(req, res) {
    try {
      const userId = req.user.userId;
      const profileData = req.body;
      
      const profile = await ProviderProfileService.upsertProfile(userId, profileData);
      
      res.json({
        success: true,
        message: "Provider profile saved successfully",
        data: profile,
      });
    } catch (error) {
      console.error("Error in upsertProfile:", error);
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  // GET /api/provider/profile/stats - Get profile statistics
  static async getProfileStats(req, res) {
    try {
      const userId = req.user.userId;
      const stats = await ProviderProfileService.getProfileStats(userId);
      
      res.json({
        success: true,
        message: "Provider profile stats retrieved successfully",
        data: stats,
      });
    } catch (error) {
      console.error("Error in getProfileStats:", error);
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  // GET /api/provider/profile/completion - Get profile completion
  static async getProfileCompletion(req, res) {
    try {
      const userId = req.user.userId;
      const completion = await ProviderProfileService.getProfileCompletion(userId);
      
      res.json({
        success: true,
        message: "Provider profile completion retrieved successfully",
        data: completion,
      });
    } catch (error) {
      console.error("Error in getProfileCompletion:", error);
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  // POST /api/provider/profile/upload-image - Upload profile image (now accepts R2 key)
  static async uploadProfileImage(req, res) {
    try {
      const userId = req.user.userId;
      const { key, url } = req.body;
      
      if (!key) {
        return res.status(400).json({
          success: false,
          message: "No image key provided",
        });
      }

      // Use the URL if provided (for public files), otherwise use the key
      // The frontend will handle getting the download URL for private files
      const imageUrl = url || key;
      
      // Update profile with image URL/key
      const profile = await ProviderProfileService.updateProfile(userId, {
        profileImageUrl: imageUrl,
      });
      
      res.json({
        success: true,
        message: "Profile image uploaded successfully",
        data: {
          profileImageUrl: imageUrl,
          profile,
        },
      });
    } catch (error) {
      console.error("Error in uploadProfileImage:", error);
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  // GET /api/provider/profile/portfolio - Get completed projects for portfolio (platform projects)
  static async getPortfolio(req, res) {
    try {
      const userId = req.user.userId;
      const projects = await ProviderProfileService.getCompletedProjects(userId);
      
      res.json({
        success: true,
        message: "Portfolio projects retrieved successfully",
        data: projects,
      });
    } catch (error) {
      console.error("Error in getPortfolio:", error);
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  // GET /api/provider/profile/portfolio-items - Get external portfolio items
  static async getPortfolioItems(req, res) {
    try {
      const userId = req.user.userId;
      const items = await ProviderProfileService.getPortfolioItems(userId);
      
      res.json({
        success: true,
        message: "Portfolio items retrieved successfully",
        data: items,
      });
    } catch (error) {
      console.error("Error in getPortfolioItems:", error);
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  // POST /api/provider/profile/portfolio-items - Create portfolio item
  static async createPortfolioItem(req, res) {
    try {
      const userId = req.user.userId;
      const portfolioData = req.body;
      
      const item = await ProviderProfileService.createPortfolioItem(userId, portfolioData);
      
      res.json({
        success: true,
        message: "Portfolio item created successfully",
        data: item,
      });
    } catch (error) {
      console.error("Error in createPortfolioItem:", error);
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  // PUT /api/provider/profile/portfolio-items/:id - Update portfolio item
  static async updatePortfolioItem(req, res) {
    try {
      const userId = req.user.userId;
      const portfolioId = req.params.id;
      const portfolioData = req.body;
      
      const item = await ProviderProfileService.updatePortfolioItem(userId, portfolioId, portfolioData);
      
      res.json({
        success: true,
        message: "Portfolio item updated successfully",
        data: item,
      });
    } catch (error) {
      console.error("Error in updatePortfolioItem:", error);
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  // DELETE /api/provider/profile/portfolio-items/:id - Delete portfolio item
  static async deletePortfolioItem(req, res) {
    try {
      const userId = req.user.userId;
      const portfolioId = req.params.id;
      
      await ProviderProfileService.deletePortfolioItem(userId, portfolioId);
      
      res.json({
        success: true,
        message: "Portfolio item deleted successfully",
      });
    } catch (error) {
      console.error("Error in deletePortfolioItem:", error);
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  // POST /api/provider/profile/portfolio-items/upload-image - Upload portfolio image/file (now accepts R2 key/URL)
  static async uploadPortfolioImage(req, res) {
    try {
      const { key, url } = req.body;
      
      if (!key) {
        return res.status(400).json({
          success: false,
          message: "No file key provided",
        });
      }

      // Use the URL if provided (for public files), otherwise use the key
      // The frontend will handle getting the download URL for private files
      const fileUrl = url || key;
      
      res.json({
        success: true,
        message: "Portfolio file uploaded successfully",
        data: {
          imageUrl: fileUrl,
        },
      });
    } catch (error) {
      console.error("Error in uploadPortfolioImage:", error);
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
}

export default ProviderProfileController;