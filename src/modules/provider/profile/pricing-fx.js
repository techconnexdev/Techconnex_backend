import { prisma } from "../../../utils/prisma.js";
import {
  fetchLatestFxSnapshot,
  hasCurrencyInSnapshot,
  normalizeCurrencyCode,
} from "../../fx/service.js";

export function profilePayloadTouchesPricing(profileData) {
  if (!profileData || typeof profileData !== "object") return false;
  if (
    Object.prototype.hasOwnProperty.call(profileData, "preferredCurrency") &&
    profileData.preferredCurrency != null &&
    String(profileData.preferredCurrency).trim() !== ""
  ) {
    return true;
  }
  const keys = ["hourlyRate", "minimumProjectBudget", "maximumProjectBudget"];
  return keys.some((k) =>
    Object.prototype.hasOwnProperty.call(profileData, k),
  );
}

export async function upsertSettingsPreferredCurrency(userId, preferredCurrencyRaw) {
  const code = normalizeCurrencyCode(preferredCurrencyRaw || "MYR");
  if (!code || !/^[A-Z]{3}$/.test(code)) {
    throw new Error("Invalid currency code");
  }
  await prisma.settings.upsert({
    where: { userId },
    create: {
      userId,
      preferredCurrency: code,
    },
    update: { preferredCurrency: code },
  });
  return code;
}

/**
 * Refreshes FX snapshot columns on ProviderProfile (same BNM feed as projects).
 * Denomination currency is Settings.preferredCurrency. No new rows — updates existing profile.
 */
export async function syncProviderProfilePricingFx(userId) {
  const profileRow = await prisma.providerProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!profileRow) return;

  const settings = await prisma.settings.findUnique({
    where: { userId },
    select: { preferredCurrency: true },
  });
  const code = normalizeCurrencyCode(settings?.preferredCurrency || "MYR");

  const fx = await fetchLatestFxSnapshot();
  if (!hasCurrencyInSnapshot(code, fx.ratesMap)) {
    throw new Error(
      "Selected currency is not available in the current exchange rate feed. Choose another currency or try again later.",
    );
  }

  await prisma.providerProfile.update({
    where: { userId },
    data: {
      fxSnapshotDate: fx.date || null,
      fxSnapshotSession: fx.session || null,
      fxSnapshotQuote: fx.quote || "RM",
      fxSnapshotRatesJson: fx.ratesMap,
    },
  });
}
