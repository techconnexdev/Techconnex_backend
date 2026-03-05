import { OAuth2Client } from "google-auth-library";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { findUserByEmail } from "./model.js";
import { createProviderUser } from "./provider/model.js";
import { createCompanyUser } from "./company/model.js";
import { notifyAdminsOfNewUser } from "../notifications/service.js";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * Verify Google id_token and return payload (email, name, picture).
 * @param {string} idToken - Google ID token from frontend
 * @returns {Promise<{ email: string, name: string, picture?: string }>}
 */
async function verifyGoogleToken(idToken) {
  if (!idToken || typeof idToken !== "string") throw new Error("ID token is required");
  if (!process.env.GOOGLE_CLIENT_ID) throw new Error("Google OAuth is not configured");

  const ticket = await client.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  if (!payload?.email) throw new Error("Invalid Google token: no email");

  return {
    email: payload.email,
    name: payload.name || payload.email.split("@")[0] || "User",
    picture: payload.picture || null,
  };
}

/**
 * Login or register with Google.
 * - If user exists: log them in (role optional).
 * - If user does not exist and role is provided: create account for that role.
 * - If user does not exist and role is missing: throw (e.g. login page flow).
 * @param {{ idToken: string, role?: 'provider' | 'customer' }}
 * @returns {{ token: string, user: object }}
 */
async function authWithGoogle({ idToken, role }) {
  const { email, name, picture } = await verifyGoogleToken(idToken);
  const existingUser = await findUserByEmail(email);

  if (existingUser) {
    if (existingUser.settings?.deletedAt) {
      throw new Error("This account was deleted. Please contact support.");
    }
    if (existingUser.status === "SUSPENDED") {
      throw new Error("Your account has been suspended. Please contact support.");
    }
    const token = jwt.sign(
      { userId: existingUser.id, role: existingUser.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );
    const { password: _p, ...safeUser } = existingUser;
    return { token, user: safeUser };
  }

  // New user: role required for registration
  const normalizedRole = (role || "").toLowerCase();
  if (normalizedRole !== "provider" && normalizedRole !== "customer") {
    throw new Error("No account found. Please register first.");
  }

  const randomPassword = crypto.randomBytes(32).toString("hex");
  const hashedPassword = await bcrypt.hash(randomPassword, 10);

  if (normalizedRole === "provider") {
    const user = await createProviderUser({
      email,
      password: hashedPassword,
      name,
      phone: null,
      role: ["PROVIDER"],
      kycStatus: "pending_verification",
      isVerified: false,
      providerProfile: {},
    });
    try {
      await notifyAdminsOfNewUser({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      });
    } catch (e) {
      console.error("Failed to notify admins of new Google provider:", e);
    }
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );
    const { password: _p, ...safeUser } = user;
    return { token, user: safeUser };
  }

  const user = await createCompanyUser({
    email,
    password: hashedPassword,
    name: name || "My Company",
    phone: null,
    role: ["CUSTOMER"],
    kycStatus: "pending_verification",
    isVerified: false,
    customerProfile: {},
  });
  try {
    await notifyAdminsOfNewUser({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
  } catch (e) {
    console.error("Failed to notify admins of new Google company:", e);
  }
  const token = jwt.sign(
    { userId: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
  const { password: _p, ...safeUser } = user;
  return { token, user: safeUser };
}

export { verifyGoogleToken, authWithGoogle };
