import express from "express";
import { authenticateToken } from "../../middlewares/auth.js";
import { getConversation, sendMessage } from "./controller.js";

const router = express.Router();

router.use(authenticateToken);

router.get("/", getConversation);
router.post("/message", sendMessage);

export default router;
