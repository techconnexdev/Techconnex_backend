import { PrismaClient } from "@prisma/client";
import { userModel } from "../auth/admin/model.js";

const prisma = new PrismaClient();

export const getNotificationsByUser = async (userId) => {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
};

export const markNotificationAsRead = async (notificationId, userId) => {
  // Verify the notification belongs to the user before updating
  const notification = await prisma.notification.findFirst({
    where: {
      id: notificationId,
      userId: userId,
    },
  });

  if (!notification) {
    throw new Error("Notification not found or access denied");
  }

  // Update the notification to mark it as read
  return prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
  });
};

export const createNotification = async (data) => {
  return prisma.notification.create({
    data: {
      userId: data.userId,
      title: data.title,
      type: data.type || "system",
      content: data.content,
      metadata: data.metadata || null,
    },
  });
};

/**
 * Notify all admin users about a new user registration
 * @param {Object} userData - The newly registered user data
 * @param {string} userData.id - User ID
 * @param {string} userData.name - User name
 * @param {string} userData.email - User email
 * @param {Array<string>} userData.role - User roles
 */
export const notifyAdminsOfNewUser = async (userData) => {
  try {
    // Get all admin users
    const admins = await userModel.findAllAdmins();
    
    if (!admins || admins.length === 0) {
      console.log("No admin users found to notify");
      return;
    }

    // Determine user type based on roles
    const roles = Array.isArray(userData.role) ? userData.role : [userData.role];
    const isAdmin = roles.includes("ADMIN");
    const isProvider = roles.includes("PROVIDER");
    const isCustomer = roles.includes("CUSTOMER");
    
    let userType = "User";
    if (isAdmin) {
      userType = "Admin";
    } else if (isProvider && isCustomer) {
      userType = "Provider & Customer";
    } else if (isProvider) {
      userType = "Provider";
    } else if (isCustomer) {
      userType = "Customer";
    }

    // Create notification for each admin (excluding the newly registered user if they are an admin)
    const notificationPromises = admins
      .filter((admin) => admin.id !== userData.id) // Don't notify the new user about themselves
      .map((admin) =>
        createNotification({
          userId: admin.id,
          title: "New User Registration",
          type: "system",
          content: `A new ${userType} has registered: ${userData.name} (${userData.email})`,
          metadata: {
            newUserId: userData.id,
            newUserName: userData.name,
            newUserEmail: userData.email,
            newUserRole: roles,
            eventType: "user_registration",
          },
        })
      );

    await Promise.all(notificationPromises);
    const notifiedCount = admins.filter((admin) => admin.id !== userData.id).length;
    console.log(`Notifications sent to ${notifiedCount} admin(s) about new user registration`);
  } catch (error) {
    // Log error but don't throw - registration should still succeed even if notification fails
    console.error("Failed to notify admins of new user registration:", error);
  }
};