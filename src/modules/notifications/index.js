import express from "express";
import {
  getNotificationsByUserController,
  markNotificationAsReadController,
  markNotificationsAsReadController,
} from "./controller.js";
import { authenticateToken } from "../../middlewares/auth.js";

const router = express.Router();

// GET notifications for logged-in user (?grouped=1 for grouped by project + type)
router.get("/", authenticateToken, getNotificationsByUserController);

// PATCH mark multiple notifications as read (body: { ids: string[] })
router.patch("/read-bulk", authenticateToken, markNotificationsAsReadController);

// PATCH mark single notification as read
router.patch("/:id/read", authenticateToken, markNotificationAsReadController);

export default router;