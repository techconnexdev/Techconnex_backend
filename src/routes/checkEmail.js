import express from "express";
import { findUserByEmail } from "../modules/auth/model.js";

const router = express.Router();

// GET /api/check-email?email=someone@example.com
router.get("/check-email", async (req, res) => {
  try {
    const email = (req.query.email || "").toString().trim().toLowerCase();
    if (!email) return res.status(400).json({ error: "Email is required" });

    const user = await findUserByEmail(email);
    return res.json({ available: !user });
  } catch (err) {
    console.error("check-email error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
