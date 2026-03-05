// src/modules/auth/controller.js
import { loginProvider, checkEmailAvailability, sendEmailOtp, verifyEmailOtp, requestPasswordReset, resetPasswordWithToken } from "./service.js";
import { authWithGoogle } from "./googleAuth.js";

async function login(req, res) {
  try {
    const { email, password } = req.body;
    const { token, user } = await loginProvider({ email, password });
    res.status(200).json({ success: true, token, user });
  } catch (error) {
    res.status(401).json({ success: false, message: error.message });
  }
}

async function checkEmail(req, res) {
  try {
    const { email } = req.query;

    if (!email) return res.status(400).json({ error: "Email is required" });

    const result = await checkEmailAvailability(email);
    return res.json(result);
  } catch (err) {
    console.error("check-email error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function sendEmailOtpHandler(req, res) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, error: "Email is required" });
    await sendEmailOtp(email);
    return res.json({ success: true, sent: true });
  } catch (err) {
    const status = err.message === "This email is already registered" ? 400 : 500;
    return res.status(status).json({ success: false, error: err.message });
  }
}

async function verifyEmailOtpHandler(req, res) {
  try {
    const { email, otp } = req.body;
    if (!email) return res.status(400).json({ success: false, error: "Email is required" });
    if (!otp) return res.status(400).json({ success: false, error: "OTP is required" });
    await verifyEmailOtp(email, otp);
    return res.json({ success: true, verified: true });
  } catch (err) {
    const status = err.message?.includes("expired") || err.message?.includes("Invalid") ? 400 : 500;
    return res.status(status).json({ success: false, error: err.message });
  }
}

async function forgotPasswordHandler(req, res) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, error: "Email is required" });
    await requestPasswordReset(email);
    return res.json({ success: true, sent: true });
  } catch (err) {
    const status = err.message === "Invalid email format" ? 400 : 500;
    return res.status(status).json({ success: false, error: err.message });
  }
}

async function resetPasswordHandler(req, res) {
  try {
    const { token, password } = req.body;
    if (!token) return res.status(400).json({ success: false, error: "Token is required" });
    if (!password) return res.status(400).json({ success: false, error: "Password is required" });
    await resetPasswordWithToken(token, password);
    return res.json({ success: true });
  } catch (err) {
    const status = err.message?.includes("expired") || err.message?.includes("Invalid") || err.message?.includes("at least") ? 400 : 500;
    return res.status(status).json({ success: false, error: err.message });
  }
}

async function googleAuth(req, res) {
  try {
    const { idToken, role } = req.body;
    const { token, user } = await authWithGoogle({ idToken, role });
    res.status(200).json({ token, user });
  } catch (err) {
    const status = err.message?.includes("not configured") ? 503 : 400;
    res.status(status).json({ success: false, message: err.message });
  }
}

export { login, checkEmail, sendEmailOtpHandler, verifyEmailOtpHandler, forgotPasswordHandler, resetPasswordHandler, googleAuth };
