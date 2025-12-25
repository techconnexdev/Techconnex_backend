// index.js
import express from "express";
import { createMethod, deleteMethod, downloadReceipt, exportEarningsReport, getAllPayoutMethods, getEarningsOverviewController, getMethod, getPaymentDetails, getProviderBillingController, updateMethod } from "./controller.js";
import { authenticateToken } from "../../../middlewares/auth.js";

const router = express.Router();

// ✅ Protected route
router.get("/", authenticateToken, getProviderBillingController);
router.get("/overview", authenticateToken, getEarningsOverviewController);
router.get("/export/report", authenticateToken, exportEarningsReport);

// ⚠️ IMPORTANT: Place specific routes BEFORE parameterized routes
router.get("/bank", authenticateToken, getAllPayoutMethods);       // fetch all
router.get("/bank/:id", authenticateToken, getMethod);             // fetch single
router.post("/bank", authenticateToken, createMethod);             // create new
router.put("/bank/:id", authenticateToken, updateMethod);          // update existing
router.delete("/bank/:id", authenticateToken, deleteMethod);       // delete existing

// Place parameterized routes LAST
router.get("/:paymentId", authenticateToken, getPaymentDetails);
router.get("/:paymentId/receipt", authenticateToken, downloadReceipt);

export default router;