/**
 * In-memory store for email OTPs. Key: normalized email, Value: { otp, expiresAt }.
 * For production with multiple servers, replace with Redis or DB.
 */
const store = new Map();

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

function normalizeEmail(email) {
  return (email || "").toString().trim().toLowerCase();
}

export function setOtp(email, otp) {
  const key = normalizeEmail(email);
  store.set(key, {
    otp: String(otp),
    expiresAt: Date.now() + OTP_TTL_MS,
  });
}

export function getOtp(email) {
  const key = normalizeEmail(email);
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.otp;
}

export function deleteOtp(email) {
  store.delete(normalizeEmail(email));
}
