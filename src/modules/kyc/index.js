import express from "express";
import  { getKycDocumentById, getKycDocuments, getUserWithKycData } from "./controller.js";
import { authenticateToken } from "../../middlewares/auth.js";

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);
// KYC document routes
router.get("/kyc-documents", authenticateToken, getKycDocuments);
router.get("/kyc-documents/:documentId", authenticateToken, getKycDocumentById);
router.get("/user-kyc-data", authenticateToken, getUserWithKycData);


export default router;