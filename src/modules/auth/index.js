import express from "express";
import {
  checkEmail,
  login,
  sendEmailOtpHandler,
  verifyEmailOtpHandler,
  sendWhatsAppOtpHandler,
  verifyWhatsAppOtpHandler,
  sendLoginWhatsAppOtpHandler,
  verifyLoginWhatsAppOtpHandler,
  forgotPasswordHandler,
  resetPasswordHandler,
  googleAuth,
} from "./controller.js";

const router = express.Router();

router.post("/login", login);
router.post("/google", googleAuth);
router.get("/check-email", checkEmail);
router.post("/send-email-otp", sendEmailOtpHandler);
router.post("/verify-email-otp", verifyEmailOtpHandler);
router.post("/send-whatsapp-otp", sendWhatsAppOtpHandler);
router.post("/verify-whatsapp-otp", verifyWhatsAppOtpHandler);
router.post("/send-login-whatsapp-otp", sendLoginWhatsAppOtpHandler);
router.post("/verify-login-whatsapp-otp", verifyLoginWhatsAppOtpHandler);
router.post("/forgot-password", forgotPasswordHandler);
router.post("/reset-password", resetPasswordHandler);

export default router;
