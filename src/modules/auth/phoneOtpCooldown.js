/** Last WhatsApp OTP send time per E.164 (ms). */
const lastSend = new Map();

const COOLDOWN_MS = 60 * 1000;

export function assertPhoneOtpCooldown(e164) {
  const key = String(e164).trim();
  const prev = lastSend.get(key) || 0;
  const now = Date.now();
  if (now - prev < COOLDOWN_MS) {
    const wait = Math.ceil((COOLDOWN_MS - (now - prev)) / 1000);
    throw new Error(`Please wait ${wait}s before requesting another code.`);
  }
}

export function markPhoneOtpSent(e164) {
  lastSend.set(String(e164).trim(), Date.now());
}
