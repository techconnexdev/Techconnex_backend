import { getNotificationsByUser, markNotificationAsRead } from "./service.js";


export const getNotificationsByUserController = async (req, res) => {
  try {
    // Get user ID from JWT payload (could be userId or id)
    const userId = req.user?.userId || req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User ID not found in token",
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
    return res.status(error.message === "Notification not found or access denied" ? 404 : 500).json({
      success: false,
      message: error.message || "Error marking notification as read",
    });
  }
};
