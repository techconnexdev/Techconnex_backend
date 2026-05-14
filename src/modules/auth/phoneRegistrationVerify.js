/**
 * After a successful registration WhatsApp OTP verify, we mark the phone so
 * signup can set phoneVerified=true only when this window is consumed (prevents spoofing).
 */
import { normalizeToE164 } from "./twilioWhatsApp.js";

const TTL_MS = 30 * 60 * 1000;
/** @type {Map<string, number>} */
const readyUntil = new Map();

export function markPhoneReadyForRegistration(phone) {
  const key = normalizeToE164(phone);
  readyUntil.set(key, Date.now() + TTL_MS);
}

/**
 * @param {string} phone
 * @returns {boolean} true once if a recent verify succeeded for this phone
 */
export function consumePhoneReadyForRegistration(phone) {
  const key = normalizeToE164(phone);
  const exp = readyUntil.get(key);
  if (!exp || Date.now() > exp) {
    readyUntil.delete(key);
    return false;
  }
  readyUntil.delete(key);
  return true;
}
