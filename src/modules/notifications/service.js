import { PrismaClient } from "@prisma/client";
import { userModel } from "../auth/admin/model.js";

const prisma = new PrismaClient();

export const getNotificationsByUser = async (userId) => {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
};

/**
 * Build a group key for grouping notifications by project + type (+ eventType for proposals).
 * Notifications with same groupKey will be shown as one (e.g. "3 new proposals for Project X").
 */
function getGroupKey(notification) {
  const meta = notification.metadata && typeof notification.metadata === "object" ? notification.metadata : {};
  const projectId = meta.projectId || null;
  const serviceRequestId = meta.serviceRequestId || null;
  const eventType = meta.eventType || "";
  const type = notification.type || "system";
  if (projectId) return `p:${projectId}:${type}:${eventType}`;
  if (serviceRequestId) return `s:${serviceRequestId}:${type}:${eventType}`;
  return `u:${notification.id}:${type}:${eventType}`;
}

/**
 * Build linkPath from notification metadata for click-through navigation.
 */
function getLinkPath(notification) {
  const meta = notification.metadata && typeof notification.metadata === "object" ? notification.metadata : {};
  if (meta.linkPath && typeof meta.linkPath === "string") return meta.linkPath;
  if (meta.projectId) {
    if (notification.type === "proposal" && (meta.eventType === "proposal_accepted" || meta.eventType === "proposal_rejected"))
      return `/provider/projects/${meta.projectId}`;
    if (notification.type === "milestone" || notification.type === "project" || notification.type === "payment")
      return `/provider/projects/${meta.projectId}`;
    return `/customer/projects/${meta.projectId}`;
  }
  if (meta.serviceRequestId) return `/customer/projects/${meta.serviceRequestId}`;
  return null;
}

/**
 * Get project/source name from notification for grouped title.
 */
function getProjectName(notification) {
  const meta = notification.metadata && typeof notification.metadata === "object" ? notification.metadata : {};
  if (meta.projectTitle) return meta.projectTitle;
  if (meta.serviceRequestTitle) return meta.serviceRequestTitle;
  return notification.title || "Project";
}

/**
 * Group notifications by projectId/serviceRequestId + type + eventType (Facebook-style).
 * Returns { grouped: Array<{ id, projectName, type, eventType, count, latestAt, notificationIds, linkPath, isRead }> }.
 */
export const getNotificationsByUserGrouped = async (userId) => {
  const list = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  const map = new Map();
  for (const n of list) {
    const key = getGroupKey(n);
    if (!map.has(key)) {
      map.set(key, {
        id: n.id,
        projectName: getProjectName(n),
        type: n.type,
        eventType: (n.metadata && n.metadata.eventType) || "",
        count: 0,
        latestAt: n.createdAt,
        notificationIds: [],
        linkPath: getLinkPath(n),
        isRead: true,
        title: n.title,
        content: n.content,
      });
    }
    const g = map.get(key);
    g.count += 1;
    g.notificationIds.push(n.id);
    if (new Date(n.createdAt) > new Date(g.latestAt)) {
      g.latestAt = n.createdAt;
      g.linkPath = getLinkPath(n);
      g.id = n.id;
      g.title = n.title;
      g.content = n.content;
    }
    if (!n.isRead) g.isRead = false;
  }

  const grouped = Array.from(map.values()).map((g) => ({
    id: g.id,
    projectName: g.projectName,
    type: g.type,
    eventType: g.eventType,
    count: g.count,
    latestAt: g.latestAt,
    notificationIds: g.notificationIds,
    linkPath: g.linkPath,
    isRead: g.isRead,
    title: g.title,
    content: g.content,
  }));

  return grouped;
};

export const markNotificationAsRead = async (notificationId, userId) => {
  const notification = await prisma.notification.findFirst({
    where: {
      id: notificationId,
      userId: userId,
    },
  });

  if (!notification) {
    throw new Error("Notification not found or access denied");
  }

  return prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
  });
};

/** Mark multiple notifications as read (e.g. when opening a grouped notification). */
export const markNotificationsAsRead = async (notificationIds, userId) => {
  if (!Array.isArray(notificationIds) || notificationIds.length === 0) return;
  await prisma.notification.updateMany({
    where: {
      id: { in: notificationIds },
      userId,
    },
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
 * Send an announcement notification to all users (for admin broadcast).
 * Creates one notification per user with type "announcement" so it appears under Announcements.
 * @returns { number } count of users notified
 */
export const createBroadcastNotification = async ({ title, content }) => {
  const users = await prisma.user.findMany({
    select: { id: true },
  });
  const type = "announcement";
  const metadata = { eventType: "announcement" };
  await Promise.all(
    users.map((u) =>
      prisma.notification.create({
        data: {
          userId: u.id,
          title,
          type,
          content,
          metadata,
        },
      })
    )
  );
  return users.length;
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