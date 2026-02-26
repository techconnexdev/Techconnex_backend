import express from "express";
import multer from "multer";
import { authenticateToken, requireAdmin } from "../../../middlewares/auth.js";
import {
  listConversations,
  getConversation,
  sendAdminMessage,
  updateConversation,
  listReferences,
  uploadReference,
  reindexReference,
} from "./controller.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } }); // 20 MB

router.use(authenticateToken, requireAdmin);

router.get("/conversations", listConversations);
router.get("/conversations/:id", getConversation);
router.post("/conversations/:id/message", sendAdminMessage);
router.patch("/conversations/:id", updateConversation);

router.get("/references", listReferences);
router.post("/references/upload", upload.single("file"), uploadReference);
router.post("/references/:id/reindex", reindexReference);

export default router;
