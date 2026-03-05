/**
 * In-memory store for password reset tokens.
 * Key: token string, Value: { userId, email, expiresAt }.
 * For production with multiple servers, replace with Redis or DB.
 */
const store = new Map();

const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

import crypto from "crypto";

function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

export function setResetToken(email, userId) {
  const token = generateToken();
  store.set(token, {
    userId,
    email: (email || "").toString().trim().toLowerCase(),
    expiresAt: Date.now() + RESET_TTL_MS,
  });
  return token;
}

export function getResetToken(token) {
  if (!token || typeof token !== "string") return null;
  const entry = store.get(token.trim());
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(token.trim());
    return null;
  }
  return entry;
}

export function deleteResetToken(token) {
  if (token) store.delete(String(token).trim());
}
