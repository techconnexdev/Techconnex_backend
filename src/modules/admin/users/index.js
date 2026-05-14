import express from "express";
import { userController } from "./controller.js";
import { authenticateToken, requireAdmin } from "../../../middlewares/auth.js";

const router = express.Router();

// All routes require admin authentication
router.use(authenticateToken, requireAdmin);

// Get all users with filters
router.get("/", userController.getAllUsers);

// Get user stats
router.get("/stats", userController.getUserStats);

// Export users as PDF
router.get("/export", userController.exportUsers);

// Create new user
router.post("/", userController.createUser);

// Send notification to all users (announcements)
router.post("/notifications/broadcast", userController.broadcastNotification);

// Get user by ID
router.get("/:id", userController.getUserById);

// Suspend user
router.patch("/:id/suspend", userController.suspendUser);

// Activate user
router.patch("/:id/activate", userController.activateUser);

// Restore soft-deleted account (clear settings.deletedAt)
router.patch("/:id/restore", userController.restoreDeletedAccount);

// Update user
router.patch("/:id", userController.updateUser);

export default router;

