/**
 * Immediate handoff: account/payment/dispute/access issues (no confirmation needed).
 * Does NOT include "human"/"agent" phrases—those go through AI first for guidance + confirmation.
 */
const HANDOFF_KEYWORDS = [
  "my account",
  "account balance",
  "refund",
  "dispute",
  "disputes",
  "kyc",
  "verify my",
  "verification status",
  "can't log",
  "cannot log",
  "login issue",
  "locked out",
  "my payment",
  "withdrawal",
  "payout",
  "invoice problem",
  "billing issue",
  "charge dispute",
  "suspended",
  "ban",
  "speak to agent",
  "talk to a person",
  "real person",
  "human agent",
  "support agent",
  "live agent",
  "contact support",
  "support team",
  "support agent",
  "support team",
  "support team",
];

/**
 * User is insisting on being transferred after AI offered guidance (short, confirmation-style messages).
 * Triggers handoff only when they clearly confirm.
 */
const INSISTENCE_PATTERNS = [
  /(?:yes|yeah|please|ok|okay),?\s*(?:transfer|connect|put me through)/i,
  /(?:transfer|connect)\s*(?:me|us)/i,
  /(?:i\s+)?(?:want|need)\s+(?:to\s+be\s+)?(?:transfer(?:red)?|connect(?:ed)?)/i,
  /(?:just|please)\s*(?:transfer|connect)/i,
  /i\s+insist/i,
  /(?:yes|yeah),?\s*(?:i\s+)?(?:want|need)\s+(?:a\s+)?(?:human|person|agent)/i,
  /(?:connect|transfer)\s*(?:me\s+)?(?:to\s+)?(?:a\s+)?(?:human|agent|person|support)/i,
  /(?:human|agent|person|support)\s*(?:please|now)/i,
  /^transfer\s*me\.?$/i,
  /^connect\s*me\.?$/i,
  /^please\s*transfer\.?$/i,
  /^yes,?\s*(?:please\s+)?(?:transfer|connect)/i,
];

/**
 * Check if message content clearly requires human handoff.
 * - Immediate for account/payment/dispute keywords.
 * - For "human/agent" requests we only trigger when user insists (confirmation-style reply).
 * @param {string} content
 * @returns {boolean}
 */
export function needsHumanHandoff(content) {
  if (!content || typeof content !== "string") return false;
  const lower = content.toLowerCase().trim();
  if (HANDOFF_KEYWORDS.some((kw) => lower.includes(kw))) return true;
  return INSISTENCE_PATTERNS.some((re) => re.test(lower.trim()));
}

export const HANDOFF_MESSAGE =
  "A support agent will join this chat shortly to help you. Please wait.";
