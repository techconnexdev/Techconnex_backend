// /routes/settings.routes.js
import express from "express";
import {
  getSettings,
  updateUserNotifications,
  updateUserPrivacy,
  updateUserSecurity,
  updateUserLocale,
  updateUserPreferredCurrency,
  deleteUserAccount,
  getUserPayments,
} from "./controller.js";

const router = express.Router();

router.get("/:userId", getSettings);
router.put("/:userId/notifications", updateUserNotifications);
router.put("/:userId/privacy", updateUserPrivacy);
router.put("/:userId/security", updateUserSecurity);
router.put("/:userId/locale", updateUserLocale);
router.put("/:userId/preferred-currency", updateUserPreferredCurrency);
router.delete("/:userId", deleteUserAccount);
// 💳 Payments
router.get("/:userId/payments", getUserPayments);

export default router;
