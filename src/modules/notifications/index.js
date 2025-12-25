import express from "express";
import { getNotificationsByUserController, markNotificationAsReadController } from "./controller.js";
import { authenticateToken } from "../../middlewares/auth.js";

const router = express.Router();

// GET notifications for logged-in user
router.get("/", authenticateToken, getNotificationsByUserController);

// PATCH mark notification as read
router.patch("/:id/read", authenticateToken, markNotificationAsReadController);

export default router;