/**
 * Detect only when the user clearly needs a human (account-specific, payments, disputes, KYC, access issues, or explicitly asks for a person).
 * Do NOT trigger for general "how to" questions or when the AI simply doesn't have the answer in the manuals.
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
];

/**
 * Check if message content clearly requires human handoff (not for simple how-to questions).
 * @param {string} content
 * @returns {boolean}
 */
export function needsHumanHandoff(content) {
  if (!content || typeof content !== "string") return false;
  const lower = content.toLowerCase().trim();
  return HANDOFF_KEYWORDS.some((kw) => lower.includes(kw));
}

export const HANDOFF_MESSAGE =
  "A support agent will join this chat shortly to help you. Please wait.";
