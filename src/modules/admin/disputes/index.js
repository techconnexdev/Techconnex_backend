import express from "express";
import { disputeController } from "./controller.js";
import { authenticateToken, requireAdmin } from "../../../middlewares/auth.js";
import { uploadBankTransferRef } from "../../../middlewares/uploadBankTransferRef.js";

const router = express.Router();

// All routes require admin authentication
router.use(authenticateToken);
router.use(requireAdmin);

// Error handling middleware for multer errors
const handleMulterError = (err, req, res, next) => {
  if (err) {
    console.error("Multer error:", err);
    return res.status(400).json({
      success: false,
      error: err.message || "File upload error",
    });
  }
  next();
};

router.get("/", disputeController.getAllDisputes);
router.get("/stats", disputeController.getDisputeStats);
router.get("/:id", disputeController.getDisputeById);
router.patch("/:id/resolve", disputeController.resolveDispute);
router.post(
  "/:id/payout",
  uploadBankTransferRef,
  handleMulterError,
  disputeController.simulatePayout
);
router.post("/:id/redo-milestone", disputeController.redoMilestone);

export default router;
