import express from "express";
import { register, becomeProviderHandler, updateProfile, updatePasswordHandler } from "./controller.js";
import { authenticateToken } from "../../../middlewares/auth.js";

const router = express.Router();

router.post("/register", register);
router.post("/become-provider", authenticateToken, becomeProviderHandler);
router.patch("/profile", authenticateToken, updateProfile);
router.patch("/profile/password", authenticateToken, updatePasswordHandler);

export default router;
