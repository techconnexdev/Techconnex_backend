import express from "express";
import {
  initiatePayment,
  releasePayment,
  confirmTransfer,
  refundPaymentController,
  getPendingPayoutsController,
  getEarningsController,
  getPaymentHistory,
} from "./controller.js";
import { authenticateToken } from "../../middlewares/auth.js";
import { handleStripeWebhook } from "./webhook.js";

const router = express.Router();

// Public routes (no auth)
// IMPORTANT: Webhook route must use raw body, not JSON parsed
router.post(
  "/webhooks/stripe",
  express.raw({ type: "application/json" }), // Use raw body for signature verification
  handleStripeWebhook
);

// Protected routes (require authentication)
router.use(authenticateToken); // Apply auth middleware to all routes below

// Customer routes
router.post("/initiate", initiatePayment); // Customer pays for milestone
router.get("/history", getPaymentHistory); // Get payment history

// Admin/Customer routes (approve milestone and release payment)
router.post("/release/:milestoneId", releasePayment);

// Admin-only routes
router.post(
  "/confirm-transfer",
  // requireRole(["ADMIN"]),
  confirmTransfer
);
router.get(
  "/pending-payouts",
  // requireRole(["ADMIN"]),
  getPendingPayoutsController
);
router.post(
  "/refund",
  // requireRole(["ADMIN"]),
  refundPaymentController
);

// router.post(
//   "/refund",
//   requireRole(["ADMIN"]),
//   refundPaymentController
// );

// Provider routes
router.get("/earnings", getEarningsController); // Provider earnings summary

export default router;
