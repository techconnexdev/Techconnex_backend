// adminSettings/service.js
import { getAdminSettings, updateAdminSettings } from "./model.js";

const PLATFORM_LOCALES = new Set(["en", "id", "ar"]);

function normalizeDefaultLocale(value) {
  const v = String(value ?? "en")
    .trim()
    .toLowerCase();
  return PLATFORM_LOCALES.has(v) ? v : "en";
}

export const fetchAdminSettings = async () => {
  const settings = await getAdminSettings();
  return settings;
};

export const editAdminSettings = async (data) => {
  const payload = data && typeof data === "object" ? { ...data } : {};

  // Optional: validate data before saving
  if (payload.platformCommission < 0 || payload.withdrawalFee < 0) {
    throw new Error("Commission and withdrawal fee cannot be negative.");
  }

  if ("defaultLocale" in payload) {
    payload.defaultLocale = normalizeDefaultLocale(payload.defaultLocale);
  }

  const updatedSettings = await updateAdminSettings(payload);
  return updatedSettings;
};
