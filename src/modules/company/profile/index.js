import express from "express";
import {
  getProfile,
  createProfile,
  updateProfile,
  upsertProfile,
  getProfileCompletion,
  getAllProfiles,
  searchProfiles,
  getProfileStats,
  getPublicProfile,
  validateProfile,
  getComprehensiveProfile,
  uploadProfileImage,
  uploadMediaGalleryImages,
} from "./controller.js";
import { authenticateToken } from "../../../middlewares/auth.js";

const router = express.Router();

// Protected routes (require authentication)
router.get("/", authenticateToken, getProfile);
router.post("/", authenticateToken, createProfile);
router.put("/", authenticateToken, updateProfile);
router.patch("/", authenticateToken, upsertProfile);
router.post("/upload-image", authenticateToken, uploadProfileImage);
router.post("/upload-media", authenticateToken, uploadMediaGalleryImages);
router.get("/completion", authenticateToken, getProfileCompletion);
router.get("/stats", authenticateToken, getProfileStats);
router.get("/comprehensive", authenticateToken, getComprehensiveProfile);

// Public routes (no authentication required)
router.get("/all", getAllProfiles);
router.get("/search", searchProfiles);
router.get("/public/:id", getPublicProfile);

// Utility routes
router.post("/validate", validateProfile);

export default router;
