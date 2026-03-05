import express from "express";
import { checkEmail, login, sendEmailOtpHandler, verifyEmailOtpHandler, forgotPasswordHandler, resetPasswordHandler, googleAuth } from "./controller.js";

const router = express.Router();

router.post("/login", login);
router.post("/google", googleAuth);
router.get("/check-email", checkEmail);
router.post("/send-email-otp", sendEmailOtpHandler);
router.post("/verify-email-otp", verifyEmailOtpHandler);
router.post("/forgot-password", forgotPasswordHandler);
router.post("/reset-password", resetPasswordHandler);

export default router;
