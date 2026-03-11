import express from "express";
import {
  getNotificationsByUserController,
  markNotificationAsReadController,
  markNotificationsAsReadController,
  subscribePushController,
  unsubscribePushController,
  getVapidPublicKeyController,
} from "./controller.js";
import { authenticateToken } from "../../middlewares/auth.js";

const router = express.Router();

// GET notifications for logged-in user (?grouped=1 for grouped by project + type)
router.get("/", authenticateToken, getNotificationsByUserController);

// PATCH mark multiple notifications as read (body: { ids: string[] })
router.patch("/read-bulk", authenticateToken, markNotificationsAsReadController);

// PATCH mark single notification as read
router.patch("/:id/read", authenticateToken, markNotificationAsReadController);

// Push notifications: subscribe / unsubscribe
router.get("/push/vapid-public", getVapidPublicKeyController);
router.post("/push/subscribe", authenticateToken, subscribePushController);
router.post("/push/unsubscribe", authenticateToken, unsubscribePushController);

export default router;