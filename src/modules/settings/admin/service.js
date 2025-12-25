// adminSettings/service.js
import { getAdminSettings, updateAdminSettings } from "./model.js";

export const fetchAdminSettings = async () => {
  const settings = await getAdminSettings();
  return settings;
};

export const editAdminSettings = async (data) => {
  // Optional: validate data before saving
  if (data.platformCommission < 0 || data.withdrawalFee < 0) {
    throw new Error("Commission and withdrawal fee cannot be negative.");
  }

  const updatedSettings = await updateAdminSettings(data);
  return updatedSettings;
};
