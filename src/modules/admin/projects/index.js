import express from "express";
import { adminProjectController } from "./controller.js";
import { authenticateToken, requireAdmin } from "../../../middlewares/auth.js";

const router = express.Router();

// All routes require admin authentication
router.use(authenticateToken);
router.use(requireAdmin);

router.get("/", adminProjectController.getAllProjects);
router.get("/stats", adminProjectController.getProjectStats);
router.get("/:id", adminProjectController.getProjectById);
router.patch("/:id", adminProjectController.updateProject);

export default router;

