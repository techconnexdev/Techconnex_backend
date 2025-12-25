// /routes/settings.routes.js
import express from "express";
import {
  getSettings,
  updateUserNotifications,
  updateUserPrivacy,
  updateUserSecurity,
  deleteUserAccount,
  getUserPayments,
} from "./controller.js";

const router = express.Router();

router.get("/:userId", getSettings);
router.put("/:userId/notifications", updateUserNotifications);
router.put("/:userId/privacy", updateUserPrivacy);
router.put("/:userId/security", updateUserSecurity);
router.delete("/:userId", deleteUserAccount);
// 💳 Payments
router.get("/:userId/payments", getUserPayments);

export default router;
