// src/modules/company/auth/controller.js
import { loginProvider, checkEmailAvailability } from "./service.js";

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

export { login, checkEmail };
