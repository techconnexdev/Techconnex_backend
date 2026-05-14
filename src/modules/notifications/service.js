
import { userModel } from "../auth/admin/model.js";
import { sendEmail } from "../auth/sendEmail.js";
import { prisma } from "../../utils/prisma.js";
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

/** Non-empty string for WhatsApp template variables (Twilio rejects empty values). */
function templateText(value, fallback) {
  const t = String(value ?? "").trim();
  return t.length ? t.slice(0, 600) : fallback;
}

/**
 * Send WhatsApp using approved Content SIDs (avoids error 63016 outside the 24h session window).
 * OTP and contact-change flows already use templates in twilioWhatsApp.js; this covers in-app notifications.
 */
async function sendTemplatedWhatsAppNotification(toE164, notification, actionUrl) {
  const tw = await import("../auth/twilioWhatsApp.js");
  const meta =
    notification.metadata && typeof notification.metadata === "object"
      ? notification.metadata
      : {};
  const type = String(notification.type || "system");
  const baseUrl =
    process.env.FRONTEND_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://www.techconnex.vip";
  const linkUrl = templateText(actionUrl, baseUrl);

  const projectTitle =
    templateText(meta.projectTitle, "") ||
    templateText(meta.serviceRequestTitle, "") ||
    templateText(notification.title, "TechConnex");

  if (type === "milestone") {
    const milestoneTitle = templateText(meta.milestoneTitle, "Milestones");
    const updateType = templateText(notification.title, "Update");
    await tw.sendWhatsAppCopyMilestoneUpdateTemplate({
      toE164,
      projectTitle,
      milestoneTitle,
      updateType,
      actionUrl: linkUrl,
    });
    return;
  }

  if (type === "proposal") {
    await tw.sendWhatsAppProposalUpdateTemplate({
      toE164,
      projectTitle,
      proposalStatus: templateText(notification.title, "Proposal"),
      amountOrReason: templateText(notification.content, "Open app for details").slice(
        0,
        500,
      ),
      actionUrl: linkUrl,
    });
    return;
  }

  if (type === "payment") {
    await tw.sendWhatsAppSystemPaymentUpdateTemplate({
      toE164,
      paymentType: templateText(notification.title, "Payment"),
      amount: templateText(
        meta.amountDisplay || meta.amount,
        templateText(notification.content, "Escrow").slice(0, 80),
      ),
      referenceOrMilestone: templateText(
        meta.milestoneTitle,
        templateText(notification.content, "Milestone").slice(0, 120),
      ),
      actionUrl: linkUrl,
    });
    return;
  }

  if (type === "dispute") {
    await tw.sendWhatsAppSystemDisputeNotificationTemplate({
      toE164,
      projectTitle,
      disputeStatus: templateText(notification.title, "Dispute"),
      shortReason: templateText(notification.content, "See app").slice(0, 400),
      actionUrl: linkUrl,
    });
    return;
  }

  if (type === "project") {
    await tw.sendWhatsAppSystemStatusTemplate({
      toE164,
      entityType: "Project",
      entityName: projectTitle.slice(0, 200),
      newStatus: templateText(
        meta.newStatus || notification.title,
        "Updated",
      ).slice(0, 200),
      actionUrl: linkUrl,
    });
    return;
  }

  if (
    type === "system" &&
    meta.eventType === "review_received" &&
    meta.reviewerName
  ) {
    await tw.sendWhatsAppSystemReviewNotificationTemplate({
      toE164,
      reviewerName: templateText(meta.reviewerName, "Client"),
      rating:
        meta.rating != null && String(meta.rating).trim() !== ""
          ? String(meta.rating)
          : "",
      projectTitle: templateText(meta.projectTitle, projectTitle).slice(0, 200),
      actionUrl: linkUrl,
    });
    return;
  }

  if (
    type === "system" &&
    (meta.action === "approved" || meta.action === "rejected")
  ) {
    await tw.sendWhatsAppKycUpdateTemplate({
      toE164,
      kycStatus: templateText(notification.title, "KYC"),
      shortNote: templateText(notification.content, "See app").slice(0, 400),
      actionUrl: linkUrl,
    });
    return;
  }

  await tw.sendWhatsAppSystemStatusTemplate({
    toE164,
    entityType: type.slice(0, 60),
    entityName: projectTitle.slice(0, 200),
    newStatus: templateText(notification.title, "Notification").slice(0, 200),
    actionUrl: linkUrl,
  });
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

/** Save or update push subscription for a user. */
export const savePushSubscription = async (userId, { endpoint, keys }) => {
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    throw new Error("Invalid subscription: endpoint, p256dh, and auth are required");
  }
  const existing = await prisma.pushSubscription.findFirst({
    where: { userId, endpoint },
  });
  if (existing) {
    return prisma.pushSubscription.update({
      where: { id: existing.id },
      data: { p256dh: keys.p256dh, auth: keys.auth },
    });
  }
  return prisma.pushSubscription.create({
    data: { userId, endpoint, p256dh: keys.p256dh, auth: keys.auth },
  });
};

/** Remove push subscription for a user. */
export const removePushSubscription = async (userId, endpoint) => {
  if (!endpoint) throw new Error("Endpoint is required");
  return prisma.pushSubscription.deleteMany({
    where: { userId, endpoint },
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

/**
 * Deliver notification via email and push based on user preferences.
 * Called asynchronously after createNotification (fire-and-forget).
 */
async function deliverNotificationChannels(notification) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: notification.userId },
      select: { email: true, phone: true },
    });
    if (!user?.email && !user?.phone) return;

    const settings = await prisma.settings.findUnique({
      where: { userId: notification.userId },
    });
    if (!settings) return;

    const baseUrl = process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_APP_URL || "https://www.techconnex.vip";
    const linkPath = getLinkPath(notification);
    const url = linkPath ? `${baseUrl}${linkPath.startsWith("/") ? "" : "/"}${linkPath}` : baseUrl;

    // Email notifications
    if (settings.emailNotifications && user.email) {
      try {
        await sendEmail({
          to: user.email,
          subject: `[TechConnex] ${notification.title}`,
          text: `${notification.content}\n\nView in app: ${url}`,
        });
      } catch (err) {
        console.error("Notification email send failed:", err);
      }
    }

    // WhatsApp (Twilio): uses SMS toggle in settings as opt-in until a dedicated field exists.
    // Must use approved Content templates (ContentSid), not free-form body, or Twilio returns 63016 outside the 24h window.
    if (settings.smsNotifications && user.phone) {
      try {
        const { isTwilioWhatsAppConfigured, normalizeToE164 } = await import(
          "../auth/twilioWhatsApp.js"
        );
        if (isTwilioWhatsAppConfigured()) {
          const e164 = normalizeToE164(user.phone);
          await sendTemplatedWhatsAppNotification(e164, notification, url);
        }
      } catch (err) {
        console.error("Notification WhatsApp send failed:", err);
      }
    }

    // Push notifications
    if (settings.pushNotifications) {
      try {
        const webpush = (await import("web-push")).default;
        const vapidPublic = process.env.VAPID_PUBLIC_KEY;
        const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
        if (!vapidPublic || !vapidPrivate) return;

        webpush.setVapidDetails("mailto:support@techconnex.vip", vapidPublic, vapidPrivate);

        const subs = await prisma.pushSubscription.findMany({
          where: { userId: notification.userId },
        });

        for (const sub of subs) {
          try {
            await webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              JSON.stringify({
                title: notification.title,
                body: notification.content,
                url: url,
              }),
              { TTL: 60 }
            );
          } catch (pushErr) {
            if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
              await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
            }
          }
        }
      } catch (err) {
        console.error("Notification push send failed:", err);
      }
    }
  } catch (err) {
    console.error("deliverNotificationChannels failed:", err);
  }
}

export const createNotification = async (data) => {
  const notification = await prisma.notification.create({
    data: {
      userId: data.userId,
      title: data.title,
      type: data.type || "system",
      content: data.content,
      metadata: data.metadata || null,
    },
  });
  deliverNotificationChannels(notification).catch((err) =>
    console.error("Notification delivery failed:", err)
  );
  return notification;
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