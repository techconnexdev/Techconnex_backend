// /controllers/settings.controller.js
import { FRIENDLY_500_MESSAGE } from "../../utils/errors.js";
import {
  getSettingsByUserId,
  updateNotifications,
  updatePrivacy,
  updateSecurity,
  updateLocale,
  updatePreferredCurrency,
  deleteAccount,
  getPaymentsService,
  getSettingsService,
} from "./service.js";

// 🔹 GET /api/settings/:userId
export const getSettings = async (req, res) => {
  try {
    const { userId } = req.params;
    const settings = await getSettingsService(userId);
    // Avoid stale UI after changing preferences (browser or intermediary caches).
    res.set("Cache-Control", "private, no-store, no-cache, must-revalidate");
    res.json(settings);
  } catch (error) {
    console.error("Error fetching settings:", error);
    res.status(500).json({ message: FRIENDLY_500_MESSAGE });
  }
};

// 🔹 GET /api/settings/:userId/payments
export const getUserPayments = async (req, res) => {
  try {
    const { userId } = req.params;
    const payments = await getPaymentsService(userId);
    res.json(payments);
  } catch (error) {
    console.error("Error fetching payments:", error);
    res.status(500).json({ message: FRIENDLY_500_MESSAGE });
  }
};

export const updateUserNotifications = async (req, res) => {
  try {
    const { userId } = req.params;
    const data = req.body;
    const updated = await updateNotifications(userId, data);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to update notifications" });
  }
};

export const updateUserPrivacy = async (req, res) => {
  try {
    const { userId } = req.params;
    const data = req.body;
    const updated = await updatePrivacy(userId, data);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to update privacy settings" });
  }
};

export const updateUserSecurity = async (req, res) => {
  try {
    const { userId } = req.params;
    const data = req.body;
    const updated = await updateSecurity(userId, data);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to update security settings" });
  }
};

export const updateUserLocale = async (req, res) => {
  try {
    const { userId } = req.params;
    const { locale, preferredCurrency } = req.body || {};
    const updated = await updateLocale(userId, locale, preferredCurrency);
    res.set("Cache-Control", "private, no-store, no-cache, must-revalidate");
    res.json(updated);
  } catch (error) {
    if (
      error.message === "Invalid locale" ||
      error.message === "Invalid preferred currency"
    ) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: "Failed to update language" });
  }
};

export const updateUserPreferredCurrency = async (req, res) => {
  try {
    const { userId } = req.params;
    const { preferredCurrency } = req.body || {};
    const updated = await updatePreferredCurrency(userId, preferredCurrency);
    res.set("Cache-Control", "private, no-store, no-cache, must-revalidate");
    res.json(updated);
  } catch (error) {
    if (error.message === "Invalid preferred currency") {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: "Failed to update preferred currency" });
  }
};

export const deleteUserAccount = async (req, res) => {
  try {
    const { userId } = req.params;
    const { password } = req.body || {};
    await deleteAccount(userId, password);
    res.json({ message: "Account deleted successfully" });
  } catch (error) {
    if (error.message === "Password is required" || error.message === "Invalid password") {
      return res.status(400).json({ error: error.message });
    }
    if (error.message === "User not found") {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: "Failed to delete account" });
  }
};
