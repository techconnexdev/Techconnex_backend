// message/index.js
import express from "express";
import {
  createNewMessage,
  deleteMessage,
  getConversations,
  getMessages,
  getProjectMessages,
  markAsRead,
} from "./controller.js";

import { authenticateToken } from "../../middlewares/auth.js";
import { uploadMessageAttachment } from "../../middlewares/uploadMessageAttachment.js";

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// ✅ File upload route - now using R2
router.post("/upload", uploadMessageAttachment, (req, res) => {
  if (!req.file) {
    return res
      .status(400)
      .json({ success: false, message: "No file uploaded" });
  }

  // Use R2 URL from middleware
  const fileUrl = req.file.r2Url || req.file.r2Key;

  res.json({
    success: true,
    fileUrl,
    filename: req.file.originalname,
    mimetype: req.file.mimetype,
  });
});

router.get("/", getMessages); // GET /api/messages?otherUserId=... or just /api/messages for all
router.get("/conversations", getConversations); // GET /api/messages/conversations
router.get("/project/:projectId", getProjectMessages); // GET /api/messages/project/:projectId - for admin access
router.post("/", createNewMessage); // POST /api/messages
router.put("/:id/read", markAsRead); // PUT /api/messages/:id/read
router.delete("/:id", deleteMessage); // DELETE /api/messages/:id
export default router;
