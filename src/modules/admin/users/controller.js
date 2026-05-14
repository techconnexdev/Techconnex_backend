import { userService } from "./service.js";
import { generateAdminUsersPDF } from "../../../utils/usersPdfGenerator.js";
import { createBroadcastNotification } from "../../notifications/service.js";

export const userController = {
  async getAllUsers(req, res) {
    try {
      const { role, status, search } = req.query;
      const filters = { role, status, search };
      
      const users = await userService.getAllUsers(filters);
      
      res.json({
        success: true,
        data: users,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },

  async getUserById(req, res) {
    try {
      const { id } = req.params;
      const user = await userService.getUserById(id);
      
      res.json({
        success: true,
        data: user,
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        error: error.message,
      });
    }
  },

  async suspendUser(req, res) {
    try {
      const { id } = req.params;
      const user = await userService.suspendUser(id);
      
      res.json({
        success: true,
        message: "User suspended successfully",
        data: user,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  },

  async activateUser(req, res) {
    try {
      const { id } = req.params;
      const user = await userService.activateUser(id);
      
      res.json({
        success: true,
        message: "User activated successfully",
        data: user,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  },

  async restoreDeletedAccount(req, res) {
    try {
      const { id } = req.params;
      const user = await userService.restoreDeletedAccount(id);

      res.json({
        success: true,
        message: "Account restored successfully",
        data: user,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  },

  async updateUser(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      const user = await userService.updateUser(id, updateData);
      
      res.json({
        success: true,
        message: "User updated successfully",
        data: user,
      });
    } catch (error) {
      console.error("[admin/users updateUser]", error.message, error);
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  },

  async getUserStats(req, res) {
    try {
      const stats = await userService.getUserStats();
      
      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },

  async createUser(req, res) {
    try {
      const userData = req.body;
      const user = await userService.createUser(userData);
      
      res.json({
        success: true,
        message: "User created successfully",
        data: user,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  },

  async exportUsers(req, res) {
    try {
      const { role, status, search } = req.query;
      const filters = { role, status, search };

      // Fetch all users with filters
      const users = await userService.getAllUsers(filters);

      // Get stats for the PDF
      const stats = await userService.getUserStats();

      // Generate PDF
      const pdfBuffer = await generateAdminUsersPDF(users, filters);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="admin-users-${Date.now()}.pdf"`
      );
      res.setHeader("Content-Length", pdfBuffer.length);

      res.send(pdfBuffer);
    } catch (error) {
      console.error("Error in exportUsers:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },

  /** POST /admin/users/notifications/broadcast – send announcement to all users */
  async broadcastNotification(req, res) {
    try {
      const { title, content } = req.body;
      if (!title || typeof title !== "string" || !title.trim()) {
        return res.status(400).json({
          success: false,
          message: "Title is required",
        });
      }
      if (!content || typeof content !== "string" || !content.trim()) {
        return res.status(400).json({
          success: false,
          message: "Content is required",
        });
      }
      const count = await createBroadcastNotification({
        title: title.trim(),
        content: content.trim(),
      });
      return res.json({
        success: true,
        message: `Notification sent to ${count} user(s)`,
        count,
      });
    } catch (error) {
      console.error("Error in broadcastNotification:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to send broadcast notification",
      });
    }
  },
};

