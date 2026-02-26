// message/index.js
import express from "express";
import {
  createNewMessage,
  deleteMessage,
  getConversations,
  getMessages,
  getProjectMessages,
  getUnreadCount,
  markAsRead,
  reportConversationHandler,
  checkReportStatusHandler,
  checkCanChatHandler,
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
router.get("/unread-count", getUnreadCount); // GET /api/messages/unread-count
router.get("/project/:projectId", getProjectMessages); // GET /api/messages/project/:projectId - for admin access
router.post("/", createNewMessage); // POST /api/messages
router.put("/:id/read", markAsRead); // PUT /api/messages/:id/read
router.delete("/:id", deleteMessage); // DELETE /api/messages/:id
router.get("/check-report", checkReportStatusHandler); // GET /api/messages/check-report?reportedUserId=...
router.get("/can-chat", checkCanChatHandler); // GET /api/messages/can-chat?otherUserId=...
router.post("/report", reportConversationHandler); // POST /api/messages/report
export default router;
