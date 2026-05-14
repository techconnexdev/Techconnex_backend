import bcrypt from "bcryptjs";
import { setOtp, getOtp, deleteOtp } from "../auth/emailOtpStore.js";
import {
  setPhoneOtp,
  getPhoneOtp,
  deletePhoneOtp,
} from "../auth/phoneOtpStore.js";
import {
  assertPhoneOtpCooldown,
  markPhoneOtpSent,
} from "../auth/phoneOtpCooldown.js";
import {
  normalizeToE164,
  sendWhatsAppOtpTemplate,
  isTwilioWhatsAppConfigured,
} from "../auth/twilioWhatsApp.js";
import { sendEmail } from "../auth/sendEmail.js";
import { verifyGoogleToken } from "../auth/googleAuth.js";
import { prisma } from "../../utils/prisma.js";

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function sendContactChangeOtp(req, res) {
  try {
    const userId = req.user.userId;
    const { channel, target = "new", email, phone } = req.body || {};
    const isCurrentTarget = String(target).toLowerCase() === "current";
    const currentUser = isCurrentTarget
      ? await prisma.user.findUnique({
          where: { id: userId },
          select: { email: true, phone: true },
        })
      : null;

    if (channel === "email") {
      const normalizedEmail = String(
        isCurrentTarget ? currentUser?.email || "" : email || "",
      )
        .trim()
        .toLowerCase();
      if (!normalizedEmail) {
        return res.status(400).json({
          success: false,
          message: isCurrentTarget
            ? "No current email found on your account."
            : "Email is required",
        });
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(normalizedEmail)) {
        return res.status(400).json({ success: false, message: "Invalid email format" });
      }

      if (!isCurrentTarget) {
        const existing = await prisma.user.findUnique({
          where: { email: normalizedEmail },
          select: { id: true },
        });
        if (existing && existing.id !== userId) {
          return res.status(400).json({
            success: false,
            message: "This email is already registered",
          });
        }
      }

      const otp = generateOtp();
      setOtp(normalizedEmail, otp);
      await sendEmail({
        to: normalizedEmail,
        subject: "Your verification code - TechConnex",
        text: `Your verification code is: ${otp}. It expires in 10 minutes. If you didn't request this, ignore this email.`,
      });
      return res.status(200).json({ success: true, sent: true });
    }

    if (channel === "phone") {
      if (!isTwilioWhatsAppConfigured()) {
        return res.status(400).json({
          success: false,
          message: "WhatsApp verification is not configured on the server.",
        });
      }
      if (isCurrentTarget && !String(currentUser?.phone || "").trim()) {
        return res.status(400).json({
          success: false,
          message: "No current phone number found on your account.",
        });
      }
      const e164 = normalizeToE164(isCurrentTarget ? currentUser?.phone || "" : phone);

      if (!isCurrentTarget) {
        const existing = await prisma.user.findFirst({
          where: {
            OR: [{ phone: e164 }, { phone: e164.replace(/^\+/, "") }],
          },
          select: { id: true },
        });
        if (existing && existing.id !== userId) {
          return res.status(400).json({
            success: false,
            message: "This phone number is already registered",
          });
        }
      }

      assertPhoneOtpCooldown(e164);
      const otp = generateOtp();
      setPhoneOtp(e164, otp);
      try {
        await sendWhatsAppOtpTemplate({
          toE164: e164,
          otp,
          purpose: "verifying",
        });
        markPhoneOtpSent(e164);
      } catch (err) {
        deletePhoneOtp(e164);
        throw err;
      }

      return res.status(200).json({ success: true, sent: true });
    }

    return res.status(400).json({
      success: false,
      message: "channel must be 'email' or 'phone'",
    });
  } catch (error) {
    console.error("Send contact change OTP error:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to send OTP",
    });
  }
}

async function verifyContactChangeOtp(req, res) {
  try {
    const userId = req.user.userId;
    const { channel, target = "new", email, phone, otp } = req.body || {};
    const isCurrentTarget = String(target).toLowerCase() === "current";
    const currentUser = isCurrentTarget
      ? await prisma.user.findUnique({
          where: { id: userId },
          select: { email: true, phone: true },
        })
      : null;
    const code = String(otp || "").trim();
    if (!code) {
      return res.status(400).json({ success: false, message: "OTP is required" });
    }

    if (channel === "email") {
      const normalizedEmail = String(
        isCurrentTarget ? currentUser?.email || "" : email || "",
      )
        .trim()
        .toLowerCase();
      if (!normalizedEmail) {
        return res.status(400).json({
          success: false,
          message: isCurrentTarget
            ? "No current email found on your account."
            : "Email is required",
        });
      }
      const stored = getOtp(normalizedEmail);
      if (!stored) {
        return res.status(400).json({
          success: false,
          message: "OTP expired or not found. Please request a new code.",
        });
      }
      if (stored !== code) {
        return res.status(400).json({ success: false, message: "Invalid verification code." });
      }
      deleteOtp(normalizedEmail);
      return res.status(200).json({ success: true, verified: true });
    }

    if (channel === "phone") {
      if (isCurrentTarget && !String(currentUser?.phone || "").trim()) {
        return res.status(400).json({
          success: false,
          message: "No current phone number found on your account.",
        });
      }
      const e164 = normalizeToE164(isCurrentTarget ? currentUser?.phone || "" : phone);
      const stored = getPhoneOtp(e164);
      if (!stored) {
        return res.status(400).json({
          success: false,
          message: "OTP expired or not found. Please request a new code.",
        });
      }
      if (stored !== code) {
        return res.status(400).json({ success: false, message: "Invalid verification code." });
      }
      deletePhoneOtp(e164);
      await prisma.user.update({
        where: { id: userId },
        data: { phoneVerified: true },
      });
      return res.status(200).json({ success: true, verified: true });
    }

    return res.status(400).json({
      success: false,
      message: "channel must be 'email' or 'phone'",
    });
  } catch (error) {
    console.error("Verify contact change OTP error:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to verify OTP",
    });
  }
}

async function verifyContactIdentity(req, res) {
  try {
    const userId = req.user.userId;
    const { method, password, idToken } = req.body || {};
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, password: true },
    });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (method === "password") {
      const raw = String(password || "");
      if (!raw) {
        return res.status(400).json({
          success: false,
          message: "Password is required",
        });
      }
      const ok = await bcrypt.compare(raw, user.password || "");
      if (!ok) {
        return res.status(400).json({
          success: false,
          message: "Current password is incorrect.",
        });
      }
      return res.status(200).json({ success: true, verified: true });
    }

    if (method === "google") {
      const token = String(idToken || "");
      if (!token) {
        return res.status(400).json({
          success: false,
          message: "Google token is required",
        });
      }
      const payload = await verifyGoogleToken(token);
      const payloadEmail = String(payload?.email || "").trim().toLowerCase();
      const userEmail = String(user.email || "").trim().toLowerCase();
      if (!payloadEmail || payloadEmail !== userEmail) {
        return res.status(400).json({
          success: false,
          message: "Google account does not match your current email.",
        });
      }
      return res.status(200).json({ success: true, verified: true });
    }

    return res.status(400).json({
      success: false,
      message: "method must be 'password' or 'google'",
    });
  } catch (error) {
    console.error("Verify contact identity error:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to verify identity",
    });
  }
}

export { sendContactChangeOtp, verifyContactChangeOtp, verifyContactIdentity };
