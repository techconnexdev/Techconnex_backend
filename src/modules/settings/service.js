// /services/settings.service.js
import prisma, { findPaymentsByUserId, findSettingsByUserId } from "./model.js";

// Get settings by userId
export const getSettingsByUserId = async (userId) => {
  return await prisma.settings.findUnique({
    where: { userId },
    include: {
      payments: {
        include: {
          project: true,
          milestone: true,
          Invoice: true,
        },
      },
    },
  });
};

// Update notification preferences
export const updateNotifications = async (userId, data) => {
  return await prisma.settings.update({
    where: { userId },
    data: {
      emailNotifications: data.emailNotifications,
      smsNotifications: data.smsNotifications,
      projectUpdates: data.projectUpdates,
      marketingEmails: data.marketingEmails,
      weeklyReports: data.weeklyReports,
    },
  });
};

// Update privacy preferences
export const updatePrivacy = async (userId, data) => {
  return await prisma.settings.update({
    where: { userId },
    data: {
      profileVisibility: data.profileVisibility,
      showEmail: data.showEmail,
      showPhone: data.showPhone,
      allowMessages: data.allowMessages,
    },
  });
};

// Update security settings
export const updateSecurity = async (userId, data) => {
  return await prisma.settings.update({
    where: { userId },
    data: {
      twoFactorEnabled: data.twoFactorEnabled,
      lastPasswordChange: new Date(),
    },
  });
};

// Delete account (soft delete)
export const deleteAccount = async (userId) => {
  await prisma.settings.update({
    where: { userId },
    data: { deletedAt: new Date() },
  });
};

export const getSettingsService = async (userId) => {
  const settings = await findSettingsByUserId(userId);
  if (!settings) throw new Error("Settings not found");
  return settings;
};

export const getPaymentsService = async (userId) => {
  const payments = await findPaymentsByUserId(userId);
  return payments;
};