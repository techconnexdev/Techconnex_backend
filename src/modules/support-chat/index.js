import express from "express";
import { authenticateToken } from "../../middlewares/auth.js";
import {
  getConversation,
  getMySessions,
  getSessionById,
  sendMessage,
  startNewConversation,
} from "./controller.js";

const router = express.Router();

router.use(authenticateToken);

router.get("/", getConversation);
router.get("/sessions", getMySessions);
router.get("/sessions/:id", getSessionById);
router.post("/start-new", startNewConversation);
router.post("/message", sendMessage);

export default router;
