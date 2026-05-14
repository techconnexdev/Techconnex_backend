// /services/settings.service.js
import prisma, { findPaymentsByUserId, findSettingsByUserId } from "./model.js";
import bcrypt from "bcryptjs";
import { invalidateRecommendationsCache } from "../provider/opportunities/recommended-service.js";
import { syncProviderProfilePricingFx } from "../provider/profile/pricing-fx.js";

/** Same defaults as customer/provider registration — admins may have User without Settings. */
const DEFAULT_SETTINGS_ROW = {
  emailNotifications: true,
  smsNotifications: false,
  pushNotifications: true,
  projectUpdates: true,
  marketingEmails: false,
  weeklyReports: true,
  profileVisibility: "public",
  showEmail: false,
  showPhone: false,
  allowMessages: true,
};

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
      pushNotifications: data.pushNotifications,
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

const ALLOWED_LOCALES = new Set(["en", "id", "ar"]);
const CURRENCY_CODE_REGEX = /^[A-Z]{3}$/;

// Update UI language (persisted; used after login).
// Optional preferredCurrency: when sent, updated in the same write (e.g. “Save language” also keeps currency in sync).
export const updateLocale = async (userId, locale, preferredCurrencyOptional) => {
  const code =
    typeof locale === "string" ? locale.trim().toLowerCase() : "";
  if (!ALLOWED_LOCALES.has(code)) {
    throw new Error("Invalid locale");
  }
  const data = { locale: code };
  if (
    preferredCurrencyOptional !== undefined &&
    preferredCurrencyOptional !== null &&
    String(preferredCurrencyOptional).trim() !== ""
  ) {
    const cur =
      typeof preferredCurrencyOptional === "string"
        ? preferredCurrencyOptional.trim().toUpperCase()
        : "";
    if (!CURRENCY_CODE_REGEX.test(cur)) {
      throw new Error("Invalid preferred currency");
    }
    data.preferredCurrency = cur;
  }
  const row = await prisma.settings.upsert({
    where: { userId },
    create: {
      userId,
      ...DEFAULT_SETTINGS_ROW,
      ...data,
    },
    update: data,
  });
  if (data.preferredCurrency) {
    invalidateRecommendationsCache(userId);
    try {
      await syncProviderProfilePricingFx(userId);
    } catch (e) {
      console.error("Provider pricing FX sync after locale/currency:", e);
      throw new Error(
        e?.message ||
          "Could not refresh exchange rates for your profile pricing. Try again.",
      );
    }
  }
  return row;
};

export const updatePreferredCurrency = async (userId, preferredCurrency) => {
  const code =
    typeof preferredCurrency === "string"
      ? preferredCurrency.trim().toUpperCase()
      : "";
  if (!CURRENCY_CODE_REGEX.test(code)) {
    throw new Error("Invalid preferred currency");
  }
  const row = await prisma.settings.upsert({
    where: { userId },
    create: {
      userId,
      ...DEFAULT_SETTINGS_ROW,
      preferredCurrency: code,
    },
    update: { preferredCurrency: code },
  });
  invalidateRecommendationsCache(userId);
  try {
    await syncProviderProfilePricingFx(userId);
  } catch (e) {
    console.error("Provider pricing FX sync after currency update:", e);
    throw new Error(
      e?.message ||
        "Could not refresh exchange rates for your profile pricing. Try again.",
    );
  }
  return row;
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
export const deleteAccount = async (userId, password) => {
  if (!password || typeof password !== "string") {
    throw new Error("Password is required");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { password: true },
  });

  if (!user) {
    throw new Error("User not found");
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    throw new Error("Invalid password");
  }

  await prisma.settings.update({
    where: { userId },
    data: { deletedAt: new Date() },
  });
};

export const getSettingsService = async (userId) => {
  let settings = await findSettingsByUserId(userId);
  if (!settings) {
    try {
      await prisma.settings.create({
        data: {
          userId,
          ...DEFAULT_SETTINGS_ROW,
        },
      });
    } catch (err) {
      // Concurrent first requests: another handler may have created the row.
      if (err?.code !== "P2002") throw err;
    }
    settings = await findSettingsByUserId(userId);
  }
  if (!settings) throw new Error("Settings not found");
  return settings;
};

export const getPaymentsService = async (userId) => {
  const payments = await findPaymentsByUserId(userId);
  return payments;
};