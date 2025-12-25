import express from "express";
import ProviderProfileController from "./controller.js";
import { authenticateToken } from "../../../middlewares/auth.js";

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Routes
router.get("/", ProviderProfileController.getProfile);
router.post("/", ProviderProfileController.createProfile);
router.put("/", ProviderProfileController.updateProfile);
router.patch("/", ProviderProfileController.upsertProfile);
router.post("/upload-image", ProviderProfileController.uploadProfileImage);
router.get("/stats", ProviderProfileController.getProfileStats);
router.get("/completion", ProviderProfileController.getProfileCompletion);
router.get("/portfolio", ProviderProfileController.getPortfolio);
router.get("/portfolio-items", ProviderProfileController.getPortfolioItems);
router.post("/portfolio-items", ProviderProfileController.createPortfolioItem);
router.post("/portfolio-items/upload-image", ProviderProfileController.uploadPortfolioImage);
router.put("/portfolio-items/:id", ProviderProfileController.updatePortfolioItem);
router.delete("/portfolio-items/:id", ProviderProfileController.deletePortfolioItem);

export default router;