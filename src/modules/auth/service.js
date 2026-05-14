// src/modules/company/auth/service.js
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { findUserByEmail, findUserByPhoneVariants, updateUserPassword } from "./model.js";
import { setOtp, getOtp, deleteOtp } from "./emailOtpStore.js";
import {
  setPhoneOtp,
  getPhoneOtp,
  deletePhoneOtp,
} from "./phoneOtpStore.js";
import { assertPhoneOtpCooldown, markPhoneOtpSent } from "./phoneOtpCooldown.js";
import {
  normalizeToE164,
  sendWhatsAppOtpTemplate,
  isTwilioWhatsAppConfigured,
} from "./twilioWhatsApp.js";
import { markPhoneReadyForRegistration } from "./phoneRegistrationVerify.js";
import { setResetToken, getResetToken, deleteResetToken } from "./passwordResetStore.js";
import { sendEmail } from "./sendEmail.js";

async function loginProvider({ email, password }) {
  const user = await findUserByEmail(email);
  if (!user) throw new Error("Your email or password is incorrect. Try again.");

  // ⚠️ Check if account is deleted
  if (user.settings && user.settings.deletedAt) {
    const deletedDate = new Date(user.settings.deletedAt).toLocaleString();
    throw new Error(`This account was deleted on ${deletedDate}.`);
  }

  // ⚠️ Check if account is suspended
  if (user.status === "SUSPENDED") {
    throw new Error("Your account has been suspended. Please contact support.");
  }

  // ✅ Verify password
  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    // Give a helpful message if this account was originally created via Google OAuth
    if (user.isGoogleAccount) {
      throw new Error(
        "This account was created via Google. Please use 'Forgot Password' to set a password, or sign in with Google."
      );
    }
    throw new Error("Your email or password is incorrect. Try again.");
  }

  // ✅ Generate token
  const token = jwt.sign(
    { userId: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  return { token, user };
}

async function checkEmailAvailability(email) {
  const normalizedEmail = (email || "").toString().trim().toLowerCase();
  if (!normalizedEmail) throw new Error("Email is required");

  const user = await findUserByEmail(normalizedEmail);
  return { available: !user };
}

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function sendEmailOtp(email) {
  const normalizedEmail = (email || "").toString().trim().toLowerCase();
  if (!normalizedEmail) throw new Error("Email is required");
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalizedEmail)) throw new Error("Invalid email format");

  const user = await findUserByEmail(normalizedEmail);
  if (user) throw new Error("This email is already registered");

  const otp = generateOtp();
  setOtp(normalizedEmail, otp);

  await sendEmail({
    to: normalizedEmail,
    subject: "Your verification code - TechConnex",
    text: `Your verification code is: ${otp}. It expires in 10 minutes. If you didn't request this, you can ignore this email.`,
  });

  return { sent: true };
}

async function verifyEmailOtp(email, otp) {
  const normalizedEmail = (email || "").toString().trim().toLowerCase();
  if (!normalizedEmail) throw new Error("Email is required");
  const code = (otp || "").toString().trim();
  if (!code) throw new Error("OTP is required");

  const stored = getOtp(normalizedEmail);
  if (!stored) throw new Error("OTP expired or not found. Please request a new code.");
  if (stored !== code) throw new Error("Invalid verification code.");

  deleteOtp(normalizedEmail);
  return { verified: true };
}

async function sendWhatsAppOtp(phone) {
  if (!isTwilioWhatsAppConfigured()) {
    throw new Error("WhatsApp verification is not configured on the server.");
  }
  const e164 = normalizeToE164(phone);
  const existing = await findUserByPhoneVariants(e164);
  if (existing) throw new Error("This phone number is already registered");

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
  return { sent: true };
}

async function verifyWhatsAppOtp(phone, otp) {
  const e164 = normalizeToE164(phone);
  const code = (otp || "").toString().trim();
  if (!code) throw new Error("OTP is required");

  const stored = getPhoneOtp(e164);
  if (!stored) throw new Error("OTP expired or not found. Please request a new code.");
  if (stored !== code) throw new Error("Invalid verification code.");

  deletePhoneOtp(e164);
  markPhoneReadyForRegistration(e164);
  return { verified: true };
}

async function sendLoginWhatsAppOtp(phone) {
  if (!isTwilioWhatsAppConfigured()) {
    throw new Error("WhatsApp verification is not configured on the server.");
  }

  const e164 = normalizeToE164(phone);
  const user = await findUserByPhoneVariants(e164);
  if (!user) throw new Error("No account found with this phone number.");
  if (user.phone && String(user.phone).trim() && !user.phoneVerified) {
    throw new Error(
      "This phone number is registered but WhatsApp verification is not completed yet. Please sign in with email or Google, then verify your phone number in your profile settings.",
    );
  }
  if (user.settings?.deletedAt) {
    const deletedDate = new Date(user.settings.deletedAt).toLocaleString();
    throw new Error(`This account was deleted on ${deletedDate}.`);
  }
  if (user.status === "SUSPENDED") {
    throw new Error("Your account has been suspended. Please contact support.");
  }

  assertPhoneOtpCooldown(e164);
  const otp = generateOtp();
  setPhoneOtp(e164, otp);

  try {
    await sendWhatsAppOtpTemplate({
      toE164: e164,
      otp,
      purpose: "logging in",
    });
    markPhoneOtpSent(e164);
  } catch (err) {
    deletePhoneOtp(e164);
    throw err;
  }

  return { sent: true };
}

async function verifyLoginWhatsAppOtp(phone, otp) {
  const e164 = normalizeToE164(phone);
  const code = (otp || "").toString().trim();
  if (!code) throw new Error("OTP is required");

  const user = await findUserByPhoneVariants(e164);
  if (!user) throw new Error("No account found with this phone number.");
  if (user.phone && String(user.phone).trim() && !user.phoneVerified) {
    throw new Error(
      "This phone number is registered but WhatsApp verification is not completed yet. Please sign in with email or Google, then verify your phone number in your profile settings.",
    );
  }
  if (user.settings?.deletedAt) {
    const deletedDate = new Date(user.settings.deletedAt).toLocaleString();
    throw new Error(`This account was deleted on ${deletedDate}.`);
  }
  if (user.status === "SUSPENDED") {
    throw new Error("Your account has been suspended. Please contact support.");
  }

  const stored = getPhoneOtp(e164);
  if (!stored) throw new Error("OTP expired or not found. Please request a new code.");
  if (stored !== code) throw new Error("Invalid verification code.");

  deletePhoneOtp(e164);

  const token = jwt.sign(
    { userId: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  return { token, user };
}

async function requestPasswordReset(email) {
  const normalizedEmail = (email || "").toString().trim().toLowerCase();
  if (!normalizedEmail) throw new Error("Email is required");
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalizedEmail)) throw new Error("Invalid email format");

  const user = await findUserByEmail(normalizedEmail);
  if (!user) {
    return { sent: false, accountExists: false };
  }

  if (user.settings?.deletedAt || user.status === "SUSPENDED") {
    return { sent: false, accountExists: true };
  }

  const token = setResetToken(normalizedEmail, user.id);
  const frontendUrl = process.env.FRONTEND_URL || process.env.APP_URL || "http://localhost:3000";
  const resetLink = `${frontendUrl}/auth/reset-password?token=${token}`;

  const actuallySent = await sendEmail({
    to: normalizedEmail,
    subject: "Reset your password - TechConnex",
    text: `You requested a password reset. Click the link below to set a new password (valid for 1 hour):\n\n${resetLink}\n\nIf you didn't request this, you can ignore this email.`,
  });

  return { sent: !!actuallySent, accountExists: true };
}

async function resetPasswordWithToken(token, newPassword) {
  if (!token || !newPassword) throw new Error("Token and new password are required");
  const trimmedPassword = String(newPassword).trim();
  if (trimmedPassword.length < 8) throw new Error("Password must be at least 8 characters");

  const entry = getResetToken(token);
  if (!entry) throw new Error("Invalid or expired reset link. Please request a new one.");

  const hashedPassword = await bcrypt.hash(trimmedPassword, 10);
  await updateUserPassword(entry.userId, hashedPassword);
  deleteResetToken(token);
  return { success: true };
}

export {
  loginProvider,
  checkEmailAvailability,
  sendEmailOtp,
  verifyEmailOtp,
  sendWhatsAppOtp,
  verifyWhatsAppOtp,
  sendLoginWhatsAppOtp,
  verifyLoginWhatsAppOtp,
  requestPasswordReset,
  resetPasswordWithToken,
};
