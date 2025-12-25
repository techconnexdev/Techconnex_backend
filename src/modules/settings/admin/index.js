// adminSettings/index.js
import express from "express";
import {
  getAdminSettingsController,
  updateSettingsController,
} from "./controller.js";

const router = express.Router();

// GET /admin/settings → Fetch settings
router.get("/", getAdminSettingsController);

// PUT /admin/settings → Update settings
router.put("/", updateSettingsController);

export default router;
