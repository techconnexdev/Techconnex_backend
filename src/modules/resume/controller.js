import { summarizeFullResume, uploadResumeFile } from "./service.js";
import { getResumeByUserId, deleteResumeRecord } from "./model.js";
import { FRIENDLY_500_MESSAGE } from "../../utils/errors.js";

export const analyzeResume = async (req, res) => {
  try {
    const { key } = req.body; // R2 key from frontend

    if (!key) {
      return res.status(400).json({ error: "No resume key provided." });
    }

    console.log("Analyzing resume from R2:", key); // 🔍 Log R2 key

    const extracted = await summarizeFullResume(key);
    return res.json({ data: extracted });
  } catch (err) {
    console.error("Resume analysis failed:", err.message);
    console.error(err.stack); // 🔍 full trace
    return res.status(500).json({ error: "AI resume analysis failed." });
  }
};

export const uploadResumeController = async (req, res) => {
  try {
    // Prefer body userId when: no auth (registration) or token user matches body (same user).
    // Otherwise use token so an authenticated user cannot assign a resume to another user.
    const fromToken = req.user?.userId || req.user?.id;
    const fromBody = req.body.userId;
    const userId =
      fromBody && (!fromToken || fromToken === fromBody)
        ? fromBody
        : fromToken;

    const { key, url } = req.body; // R2 key/URL from frontend

    if (!userId || !key) {
      return res.status(400).json({ error: "Missing key or userId." });
    }

    // Use R2 URL if provided, otherwise use key
    const fileUrl = url || key;

    const saved = await uploadResumeFile(userId, fileUrl);

    return res.status(200).json({
      success: true,
      message: "Resume uploaded successfully.",
      data: saved,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return res
      .status(500)
      .json({ error: "Resume upload failed.", details: error.message });
  }
};

// GET /resume - Get current user's resume
export const getMyResume = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated." });
    }

    const resume = await getResumeByUserId(userId);
    
    if (!resume) {
      return res.status(404).json({ error: "Resume not found." });
    }

    return res.status(200).json({
      success: true,
      data: resume,
    });
  } catch (error) {
    console.error("Get resume error:", error);
    return res.status(500).json({ error: FRIENDLY_500_MESSAGE });
  }
};

// GET /resume/:userId - Get resume by userId (for companies/admins)
export const getResumeByUserIdController = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user?.userId || req.user?.id;
    const userRoles = req.user?.roles || req.user?.role || [];
    const isAdmin = Array.isArray(userRoles) 
      ? userRoles.includes("ADMIN") 
      : userRoles === "ADMIN";
    const isCustomer = Array.isArray(userRoles) 
      ? userRoles.includes("CUSTOMER") 
      : userRoles === "CUSTOMER";

    // Only allow admins, customers (companies), or the resume owner to view
    if (!isAdmin && !isCustomer && currentUserId !== userId) {
      return res.status(403).json({ error: "Access denied." });
    }

    const resume = await getResumeByUserId(userId);
    
    if (!resume) {
      return res.status(404).json({ error: "Resume not found." });
    }

    return res.status(200).json({
      success: true,
      data: resume,
    });
  } catch (error) {
    console.error("Get resume error:", error);
    return res.status(500).json({ error: FRIENDLY_500_MESSAGE });
  }
};

// DELETE /resume - Delete current user's resume
export const deleteMyResume = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated." });
    }

    const resume = await getResumeByUserId(userId);
    
    if (!resume) {
      return res.status(404).json({ error: "Resume not found." });
    }

    await deleteResumeRecord(userId);

    return res.status(200).json({
      success: true,
      message: "Resume deleted successfully.",
    });
  } catch (error) {
    console.error("Delete resume error:", error);
    return res.status(500).json({ error: FRIENDLY_500_MESSAGE });
  }
};