import { FRIENDLY_500_MESSAGE } from "../../utils/errors.js";
import {
  getNotificationsByUser,
  getNotificationsByUserGrouped,
  markNotificationAsRead,
  markNotificationsAsRead,
  savePushSubscription,
  removePushSubscription,
} from "./service.js";

export const getNotificationsByUserController = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User ID not found in token",
      });
    }

    const grouped = req.query.grouped === "1" || req.query.grouped === "true";
    if (grouped) {
      const notifications = await getNotificationsByUserGrouped(userId);
      return res.status(200).json({
        success: true,
        data: notifications,
        grouped: true,
      });
    }

    const notifications = await getNotificationsByUser(userId);
    return res.status(200).json({
      success: true,
      data: notifications,
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching notifications",
    });
  }
};

export const markNotificationAsReadController = async (req, res) => {
  try {
    // Get user ID from JWT payload (could be userId or id)
    const userId = req.user?.userId || req.user?.id;
    const notificationId = req.params.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User ID not found in token",
      });
    }

    if (!notificationId) {
      return res.status(400).json({
        success: false,
        message: "Notification ID is required",
      });
    }

    await markNotificationAsRead(notificationId, userId);

    return res.status(200).json({
      success: true,
      message: "Notification marked as read",
    });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    const is404 = error.message === "Notification not found or access denied";
    return res.status(is404 ? 404 : 500).json({
      success: false,
      message: is404 ? error.message : FRIENDLY_500_MESSAGE,
    });
  }
};

export const markNotificationsAsReadController = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const ids = req.body?.ids;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User ID not found in token",
      });
    }
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: "ids array is required",
      });
    }

    await markNotificationsAsRead(ids, userId);
    return res.status(200).json({
      success: true,
      message: "Notifications marked as read",
    });
  } catch (error) {
    console.error("Error marking notifications as read:", error);
    return res.status(500).json({
      success: false,
      message: "Error marking notifications as read",
    });
  }
};

export const subscribePushController = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "User ID not found in token" });
    }
    const { endpoint, keys } = req.body || {};
    if (!endpoint || !keys) {
      return res.status(400).json({ success: false, message: "endpoint and keys are required" });
    }
    await savePushSubscription(userId, { endpoint, keys });
    return res.status(200).json({ success: true, message: "Push subscription saved" });
  } catch (error) {
    console.error("Push subscribe error:", error);
    return res.status(500).json({ success: false, message: FRIENDLY_500_MESSAGE });
  }
};

export const getVapidPublicKeyController = async (_req, res) => {
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) {
    return res.status(503).json({ success: false, message: "Push notifications not configured" });
  }
  return res.json({ success: true, publicKey: key });
};

export const unsubscribePushController = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "User ID not found in token" });
    }
    const { endpoint } = req.body || {};
    if (!endpoint) {
      return res.status(400).json({ success: false, message: "endpoint is required" });
    }
    await removePushSubscription(userId, endpoint);
    return res.status(200).json({ success: true, message: "Push subscription removed" });
  } catch (error) {
    console.error("Push unsubscribe error:", error);
    return res.status(500).json({ success: false, message: FRIENDLY_500_MESSAGE });
  }
};
