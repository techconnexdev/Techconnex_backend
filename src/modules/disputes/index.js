import express from "express";
import { disputeController } from "./controller.js";
import { authenticateToken } from "../../middlewares/auth.js";
// import { uploadDisputeAttachment } from "../../middlewares/uploadDisputeAttachment.js"; // Removed - using R2 now

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

router.post("/", disputeController.createDispute); // Multer middleware removed - using R2
router.get("/project/:projectId", disputeController.getDisputeByProject); // Get single dispute for project
router.get("/project/:projectId/all", disputeController.getDisputesByProject); // Get all disputes (for admin)
router.patch("/:id", disputeController.updateDispute); // Multer middleware removed - using R2

export default router;

