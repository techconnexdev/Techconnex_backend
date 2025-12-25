import express from "express";
import { authController } from "./controller.js";
import { authenticateToken, requireAdmin } from "../../../middlewares/auth.js";

const router = express.Router();

router.post("/login", authController.login);
router.post("/register", authController.register);
router.get("/me", authenticateToken, requireAdmin, authController.getProfile);

export default router;
