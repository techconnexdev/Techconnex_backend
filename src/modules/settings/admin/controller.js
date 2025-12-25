// adminSettings/controller.js
import { fetchAdminSettings, editAdminSettings } from "./service.js";

export const getAdminSettingsController = async (req, res) => {
  try {
    const settings = await fetchAdminSettings();
    res.status(200).json({
      success: true,
      data: settings, // ✅ include the fetched data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const updateSettingsController = async (req, res) => {
  try {
    const updated = await editAdminSettings(req.body);
    res.status(200).json({
      success: true,
      message: "Settings updated successfully",
      data: updated,
    });
  } catch (error) {
    console.error("Error updating settings:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to update settings",
    });
  }
};
