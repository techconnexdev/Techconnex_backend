import express from "express";
import { 
  analyzeResume, 
  uploadResumeController, 
  getMyResume,
  getResumeByUserIdController,
  deleteMyResume 
} from "./controller.js";
import { authenticateToken } from "../../middlewares/auth.js";
import jwt from "jsonwebtoken";

const router = express.Router();

// Optional authentication middleware (for registration flows)
const optionalAuthenticate = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  
  if (!token) {
    // No token - proceed without authentication (for registration)
    req.user = null;
    return next();
  }

  // If token exists, verify it
  jwt.verify(token, process.env.JWT_SECRET, (err, payload) => {
    if (err) {
      // Invalid token - proceed without authentication (for registration)
      req.user = null;
      return next();
    }

    // ✅ Normalize both possible token formats
    if (payload.userId && !payload.id) {
      payload.id = payload.userId;
    }

    // ✅ Ensure roles array
    if (Array.isArray(payload.role)) {
      payload.roles = payload.role;
    } else if (payload.role) {
      payload.roles = [payload.role];
    } else {
      payload.roles = [];
    }

    req.user = payload;
    next();
  });
};

// Resume routes now use R2 - frontend uploads to R2 first, then sends key/URL
router.post("/analyze", analyzeResume); // No auth required (for registration)
router.post("/upload", optionalAuthenticate, uploadResumeController); // Optional auth (for registration)
router.get("/", authenticateToken, getMyResume);
router.get("/:userId", authenticateToken, getResumeByUserIdController);
router.delete("/", authenticateToken, deleteMyResume);

export default router;
