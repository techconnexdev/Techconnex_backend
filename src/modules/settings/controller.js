// /controllers/settings.controller.js
import {
  getSettingsByUserId,
  updateNotifications,
  updatePrivacy,
  updateSecurity,
  deleteAccount,
  getPaymentsService,
  getSettingsService,
} from "./service.js";

// 🔹 GET /api/settings/:userId
export const getSettings = async (req, res) => {
  try {
    const { userId } = req.params;
    const settings = await getSettingsService(userId);
    res.json(settings);
  } catch (error) {
    console.error("Error fetching settings:", error);
    res.status(500).json({ message: error.message });
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
    res.status(500).json({ message: error.message });
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

export const deleteUserAccount = async (req, res) => {
  try {
    const { userId } = req.params;
    await deleteAccount(userId);
    res.json({ message: "Account deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete account" });
  }
};
