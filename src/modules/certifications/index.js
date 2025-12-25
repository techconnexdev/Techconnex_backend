import express from "express";
import { authenticateToken } from "../../middlewares/auth.js";
import { 
  uploadCertifications, 
  getCertifications, 
  createCertification, 
  updateCertification, 
  deleteCertification,
  getMyCertifications 
} from "./controller.js";

const router = express.Router();

// Authenticated routes for managing own certifications (specific routes first)
router.get("/", authenticateToken, getMyCertifications); // Get current user's certifications
router.post("/", authenticateToken, createCertification); // Create single certification
router.put("/:id", authenticateToken, updateCertification); // Update certification
router.delete("/:id", authenticateToken, deleteCertification); // Delete certification
router.post("/upload", uploadCertifications); // Legacy route for bulk upload (still supported)

// Public route for viewing other providers' certifications (parameterized route last)
router.get("/:userId", getCertifications);

export default router;
