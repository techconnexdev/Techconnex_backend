import express from "express";
import { paymentController } from "./controller.js";
import { authenticateToken, requireAdmin } from "../../../middlewares/auth.js";
import { uploadPaymentTransferProof } from "../../../middlewares/uploadPaymentTransferProof.js";

const router = express.Router();

// All routes require admin authentication
router.use(authenticateToken, requireAdmin);

// Get payment statistics
router.get("/stats", paymentController.getPaymentStats);

// Get payments ready for transfer
router.get("/ready-to-transfer", paymentController.getReadyToTransferPayments);

// Get all payments with filters
router.get("/", paymentController.getAllPayments);

// Get payment by ID
router.get("/:id", paymentController.getPaymentById);

// Confirm bank transfer (with optional file upload to R2)
router.post("/:id/confirm-transfer", uploadPaymentTransferProof, paymentController.confirmBankTransfer);

export default router;

