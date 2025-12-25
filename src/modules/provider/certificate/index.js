// src/modules/certifications/certification.routes.js
const express = require("express");
const { authenticateToken } = require("../../middlewares/auth.middleware");
import {
  uploadCertificationsController,
  getCertificationsController,
  deleteCertificationController,
} from "./certification.controller.js";

const router = express.Router();

// Upload multiple certifications
router.post("/upload", authenticateToken, uploadCertificationsController);

// Get all certifications for a user
router.get("/:userId", authenticateToken, getCertificationsController);

// Delete one certification
router.delete("/:id", authenticateToken, deleteCertificationController);

export default router;