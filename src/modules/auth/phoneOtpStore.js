/**
 * In-memory store for phone OTPs (registration). Key: normalized E.164.
 * For multiple servers, replace with Redis.
 */
const store = new Map();

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

export function setPhoneOtp(e164, otp) {
  const key = String(e164).trim();
  store.set(key, {
    otp: String(otp),
    expiresAt: Date.now() + OTP_TTL_MS,
  });
}

export function getPhoneOtp(e164) {
  const key = String(e164).trim();
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.otp;
}

export function deletePhoneOtp(e164) {
  store.delete(String(e164).trim());
}
