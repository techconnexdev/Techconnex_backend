import express from "express";
import { authenticateToken, requireAdmin } from "../../../middlewares/auth.js";
import * as controller from "./controller.js";

const router = express.Router();

router.use(authenticateToken);
router.use(requireAdmin);

router.get("/stats", controller.getStats);
router.post("/send-notification", controller.postSendNotification);
router.patch("/:id/status", controller.patchStatus);
router.get("/:id/messages", controller.getReportMessages);
router.get("/:id", controller.getReportById);
router.get("/", controller.getAllReports);

export default router;
