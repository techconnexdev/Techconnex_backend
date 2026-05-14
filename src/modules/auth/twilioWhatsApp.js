/**
 * Twilio WhatsApp (Cloud API via Twilio).
 *
 * Env (Backend .env):
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_AUTH_TOKEN
 *   TWILIO_WHATSAPP_FROM=whatsapp:+14155238886   (WhatsApp Sandbox — use this until your own number is WhatsApp-approved in Twilio)
 *   PHONE_DEFAULT_COUNTRY_CODE=60                 (optional, if users omit +country)
 *
 * Trial: recipients must be verified in Twilio; WhatsApp sandbox requires join phrase first.
 * Production: use approved WhatsApp templates for outbound messages outside session window.
 *
 * ---------------------------------------------------------------------------
 * Approved Content templates (Twilio Content SID → variable order in code)
 * Override any SID with TWILIO_WHATSAPP_*_CONTENT_SID in .env if you duplicate templates per env.
 *
 * | Twilio template name           | Default SID              | contentVariables 1–4 (see senders below) |
 * |--------------------------------|--------------------------|------------------------------------------|
 * | (OTP / auth — separate Meta category) | HX97dd36a53d20536552ec139a90099906 | sendWhatsAppOtpTemplate: single `1`=OTP or legacy 1–5 |
 * | system_status_update           | HX991641e4ba700ed277991a4593351b75 | 1=entity type, 2=entity name, 3=new status, 4=URL |
 * | system_action_required         | HXa4998eb491162588625d0853a1650830 | 1=action title, 2=context, 3=reason/deadline, 4=URL |
 * | system_payment_update          | HX0b774ebd8b256e7617800102c73ac1d0 | 1=payment type, 2=amount, 3=reference/milestone, 4=URL |
 * | system_review_notification     | HXeb9fc638d8c581e67b8bb4c84a0f0965 | 1=name, 2=star number only (e.g. 5), 3=project title, 4=URL |
 * | system_dispute_notification    | HX21c13a6f1060f940c0326c0372e6ba85 | 1=project title, 2=status, 3=details, 4=URL |
 * | proposal_update                | HXbc690477384db80234526e58df1cef2d | 1=project, 2=status line, 3=details, 4=URL |
 * | copy_milestone_update          | HX7c0351b662a88c5f0a844b06504db10b | 1=project, 2=milestone title, 3=status/update, 4=URL |
 * | milestone_update (optional alt)| HX87f693ace6c9242248452f4aaba2d943 | same 4 vars as copy_milestone_update — set TWILIO_WHATSAPP_MILESTONE_UPDATE_CONTENT_SID to use |
 * | kyc_update (3 vars)            | HXd1037f9837cf004e76c06f7f88d97fe8 | 1=status, 2=note, 3=URL |
 *
 * Do not send `body` with `contentSid` for utility/marketing sends (Twilio 63016 / policy errors).
 * ---------------------------------------------------------------------------
 */

import twilio from "twilio";

let client = null;

export function isTwilioWhatsAppConfigured() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID?.trim() &&
      process.env.TWILIO_AUTH_TOKEN?.trim() &&
      process.env.TWILIO_WHATSAPP_FROM?.trim()
  );
}

function getClient() {
  if (!isTwilioWhatsAppConfigured()) return null;
  if (!client) {
    client = twilio(
      process.env.TWILIO_ACCOUNT_SID.trim(),
      process.env.TWILIO_AUTH_TOKEN.trim()
    );
  }
  return client;
}

/**
 * Normalize user input to E.164 (+digits).
 */
export function normalizeToE164(phone) {
  const raw = String(phone || "").trim();
  if (!raw) throw new Error("Phone number is required");

  const digitsOnly = raw.replace(/\D/g, "");
  if (!digitsOnly) throw new Error("Phone number is required");

  if (raw.startsWith("+")) {
    return `+${digitsOnly}`;
  }

  const defaultCc = (process.env.PHONE_DEFAULT_COUNTRY_CODE || "")
    .replace(/\D/g, "");
  if (defaultCc) {
    const local = digitsOnly.replace(/^0+/, "");
    return `+${defaultCc}${local}`;
  }

  if (digitsOnly.length >= 10) {
    return `+${digitsOnly}`;
  }

  throw new Error(
    "Phone must include country code (e.g. +60123456789) or set PHONE_DEFAULT_COUNTRY_CODE in .env"
  );
}

export function toWhatsAppAddress(e164) {
  const n = e164.startsWith("+") ? e164 : `+${String(e164).replace(/\D/g, "")}`;
  return `whatsapp:${n}`;
}

function readOtpTemplateConfig() {
  const defaultContentSid = "HX97dd36a53d20536552ec139a90099906";
  return {
    contentSid: String(
      process.env.TWILIO_WHATSAPP_OTP_CONTENT_SID || defaultContentSid,
    ).trim(),
    accountLabel: String(
      process.env.TWILIO_WHATSAPP_OTP_ACCOUNT_LABEL || "TechConnex",
    ).trim(),
    linkingTarget: String(
      process.env.TWILIO_WHATSAPP_OTP_LINKING_TARGET || "this phone number",
    ).trim(),
    warningActor: String(
      process.env.TWILIO_WHATSAPP_OTP_WARNING_ACTOR || "TechConnex support",
    ).trim(),
  };
}

function readSystemStatusTemplateConfig() {
  const defaultContentSid = "HX991641e4ba700ed277991a4593351b75";
  return {
    contentSid: String(
      process.env.TWILIO_WHATSAPP_SYSTEM_STATUS_CONTENT_SID || defaultContentSid,
    ).trim(),
  };
}

function readSystemActionRequiredTemplateConfig() {
  const defaultContentSid = "HXa4998eb491162588625d0853a1650830";
  return {
    contentSid: String(
      process.env.TWILIO_WHATSAPP_SYSTEM_ACTION_REQUIRED_CONTENT_SID ||
        defaultContentSid,
    ).trim(),
  };
}

function readSystemPaymentUpdateTemplateConfig() {
  const defaultContentSid = "HX0b774ebd8b256e7617800102c73ac1d0";
  return {
    contentSid: String(
      process.env.TWILIO_WHATSAPP_SYSTEM_PAYMENT_UPDATE_CONTENT_SID ||
        defaultContentSid,
    ).trim(),
  };
}

function readSystemReviewNotificationTemplateConfig() {
  const defaultContentSid = "HXeb9fc638d8c581e67b8bb4c84a0f0965";
  return {
    contentSid: String(
      process.env.TWILIO_WHATSAPP_SYSTEM_REVIEW_NOTIFICATION_CONTENT_SID ||
        defaultContentSid,
    ).trim(),
  };
}

function readSystemDisputeNotificationTemplateConfig() {
  const defaultContentSid = "HX21c13a6f1060f940c0326c0372e6ba85";
  return {
    contentSid: String(
      process.env.TWILIO_WHATSAPP_SYSTEM_DISPUTE_NOTIFICATION_CONTENT_SID ||
        defaultContentSid,
    ).trim(),
  };
}

function readProposalUpdateTemplateConfig() {
  const defaultContentSid = "HXbc690477384db80234526e58df1cef2d";
  return {
    contentSid: String(
      process.env.TWILIO_WHATSAPP_PROPOSAL_UPDATE_CONTENT_SID || defaultContentSid,
    ).trim(),
  };
}

function readMilestoneUpdateTemplateConfig() {
  /** Default matches approved `copy_milestone_update` (same 4 placeholders as milestone_update). */
  const defaultContentSid = "HX7c0351b662a88c5f0a844b06504db10b";
  return {
    contentSid: String(
      process.env.TWILIO_WHATSAPP_MILESTONE_UPDATE_CONTENT_SID || defaultContentSid,
    ).trim(),
  };
}

function readCopyMilestoneUpdateTemplateConfig() {
  const defaultContentSid = "HX7c0351b662a88c5f0a844b06504db10b";
  return {
    contentSid: String(
      process.env.TWILIO_WHATSAPP_COPY_MILESTONE_UPDATE_CONTENT_SID ||
        defaultContentSid,
    ).trim(),
  };
}

function readKycUpdateTemplateConfig() {
  const defaultContentSid = "HXd1037f9837cf004e76c06f7f88d97fe8";
  return {
    contentSid: String(
      process.env.TWILIO_WHATSAPP_KYC_UPDATE_CONTENT_SID || defaultContentSid,
    ).trim(),
  };
}

/**
 * Twilio requires From as whatsapp:+E164. Accept env pasted from console as +1… only.
 */
export function normalizeWhatsAppFrom(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  if (s.toLowerCase().startsWith("whatsapp:")) {
    const rest = s.slice("whatsapp:".length).trim();
    if (rest.startsWith("+")) return `whatsapp:${rest}`;
    const d = rest.replace(/\D/g, "");
    return d ? `whatsapp:+${d}` : s;
  }
  if (s.startsWith("+")) return `whatsapp:${s}`;
  const digits = s.replace(/\D/g, "");
  return digits ? `whatsapp:+${digits}` : "";
}

/**
 * Send a WhatsApp text message (works in sandbox after user joins; production may require templates).
 * @param {{ toE164: string, body: string, contentSid?: string, contentVariables?: Record<string,string> }} opts
 */
export async function sendWhatsAppMessage({
  toE164,
  body,
  contentSid,
  contentVariables,
}) {
  const tw = getClient();
  if (!tw) {
    throw new Error(
      "WhatsApp is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_WHATSAPP_FROM."
    );
  }

  const from = normalizeWhatsAppFrom(process.env.TWILIO_WHATSAPP_FROM);
  if (!from || !from.startsWith("whatsapp:+")) {
    throw new Error(
      "TWILIO_WHATSAPP_FROM must be a WhatsApp sender, e.g. whatsapp:+15186397308 or +15186397308"
    );
  }

  const to = toWhatsAppAddress(toE164);
  const payload = { from, to };

  if (contentSid) {
    payload.contentSid = contentSid;
    if (contentVariables && Object.keys(contentVariables).length > 0) {
      payload.contentVariables = JSON.stringify(contentVariables);
    }
  } else {
    if (!body || !String(body).trim()) {
      throw new Error("Message body is required when not using contentSid");
    }
    payload.body = String(body).trim();
  }

  try {
    return await tw.messages.create(payload);
  } catch (err) {
    const code = err?.code;
    const msg = String(err?.message || err || "");
    const is63016 =
      code === 63016 ||
      /outside messaging window/i.test(msg) ||
      /use a message template instead/i.test(msg);
    const is63007 =
      code === 63007 ||
      /could not find a channel with the specified from address/i.test(msg);
    const is63013 =
      code === 63013 ||
      /channel policy violation/i.test(msg) ||
      /violates channel provider's policy/i.test(msg);
    if (is63016) {
      throw new Error(
        "Twilio error 63016: WhatsApp message is outside the 24-hour session window. " +
          "Use an approved template message. Configure TWILIO_WHATSAPP_OTP_CONTENT_SID " +
          "to your approved SID (e.g. HX97dd36a53d20536552ec139a90099906) and set " +
          "TWILIO_WHATSAPP_OTP_TEMPLATE_MODE=legacy for 5-variable templates."
      );
    }
    if (is63007) {
      const fromUsed = from;
      throw new Error(
        `Twilio error 63007: "${fromUsed}" is not a WhatsApp sender on this account. ` +
          "For sandbox testing set TWILIO_WHATSAPP_FROM to your Twilio WhatsApp Sandbox number " +
          "(Console → Messaging → Try WhatsApp; usually whatsapp:+14155238886). " +
          "A normal SMS phone number only works after that number is approved for WhatsApp in Twilio."
      );
    }
    if (is63013) {
      throw new Error(
        "Twilio error 63013: WhatsApp channel policy violation. " +
          "Most commonly this means template variables don't match the approved template schema " +
          "(wrong count/type/order, or empty values). " +
          "For one-variable OTP templates set TWILIO_WHATSAPP_OTP_TEMPLATE_MODE=single. " +
          "For 5-variable legacy templates set TWILIO_WHATSAPP_OTP_TEMPLATE_MODE=legacy and ensure all variables are non-empty."
      );
    }
    throw err;
  }
}

/**
 * Send OTP using a WhatsApp content template (Twilio Content API).
 * For Twilio Authentication templates, variable "1" must be the OTP code.
 */
export async function sendWhatsAppOtpTemplate({ toE164, otp, purpose = "verifying" }) {
  const code = String(otp || "").trim();
  if (!code) {
    throw new Error("OTP is required");
  }

  const cfg = readOtpTemplateConfig();
  if (!cfg.contentSid) {
    throw new Error(
      "TWILIO_WHATSAPP_OTP_CONTENT_SID is required for WhatsApp OTP template delivery.",
    );
  }

  const purposeText = String(purpose || "verifying").trim();
  const templateMode = String(process.env.TWILIO_WHATSAPP_OTP_TEMPLATE_MODE || "")
    .trim()
    .toLowerCase();
  const useLegacyFiveVarTemplate =
    templateMode === "legacy" ||
    templateMode === "legacy_5" ||
    templateMode === "5";

  const contentVariables = useLegacyFiveVarTemplate
    ? {
        1: purposeText || "verifying",
        2: cfg.accountLabel || "TechConnex",
        3: cfg.linkingTarget || "this phone number",
        4: code,
        5: cfg.warningActor || "TechConnex support",
      }
    : {
        1: code,
      };

  return sendWhatsAppMessage({
    toE164,
    contentSid: cfg.contentSid,
    contentVariables,
  });
}

/**
 * Send "system_status_update" using a WhatsApp content template.
 * Variables:
 *  1 = entity type, 2 = entity name, 3 = new status, 4 = details URL
 */
export async function sendWhatsAppSystemStatusTemplate({
  toE164,
  entityType,
  entityName,
  newStatus,
  actionUrl,
}) {
  const cfg = readSystemStatusTemplateConfig();
  if (!cfg.contentSid) {
    throw new Error(
      "TWILIO_WHATSAPP_SYSTEM_STATUS_CONTENT_SID is required for system status template delivery.",
    );
  }

  const typeValue = String(entityType || "").trim();
  const nameValue = String(entityName || "").trim();
  const statusValue = String(newStatus || "").trim();
  const urlValue = String(actionUrl || "").trim();

  if (!typeValue || !nameValue || !statusValue || !urlValue) {
    throw new Error(
      "System status template requires entityType, entityName, newStatus, and actionUrl.",
    );
  }

  return sendWhatsAppMessage({
    toE164,
    contentSid: cfg.contentSid,
    contentVariables: {
      1: typeValue,
      2: nameValue,
      3: statusValue,
      4: urlValue,
    },
  });
}

/**
 * Send "system_action_required" using a WhatsApp content template.
 * Variables:
 *  1 = action title, 2 = context name, 3 = due/reason, 4 = action URL
 */
export async function sendWhatsAppSystemActionRequiredTemplate({
  toE164,
  actionTitle,
  contextName,
  dueOrReason,
  actionUrl,
}) {
  const cfg = readSystemActionRequiredTemplateConfig();
  if (!cfg.contentSid) {
    throw new Error(
      "TWILIO_WHATSAPP_SYSTEM_ACTION_REQUIRED_CONTENT_SID is required for system action template delivery.",
    );
  }

  const actionTitleValue = String(actionTitle || "").trim();
  const contextNameValue = String(contextName || "").trim();
  const dueOrReasonValue = String(dueOrReason || "").trim();
  const actionUrlValue = String(actionUrl || "").trim();

  if (
    !actionTitleValue ||
    !contextNameValue ||
    !dueOrReasonValue ||
    !actionUrlValue
  ) {
    throw new Error(
      "System action required template requires actionTitle, contextName, dueOrReason, and actionUrl.",
    );
  }

  return sendWhatsAppMessage({
    toE164,
    contentSid: cfg.contentSid,
    contentVariables: {
      1: actionTitleValue,
      2: contextNameValue,
      3: dueOrReasonValue,
      4: actionUrlValue,
    },
  });
}

/**
 * Send "system_payment_update" using a WhatsApp content template.
 * Variables:
 *  1 = payment type, 2 = amount, 3 = reference/milestone, 4 = action URL
 */
export async function sendWhatsAppSystemPaymentUpdateTemplate({
  toE164,
  paymentType,
  amount,
  referenceOrMilestone,
  actionUrl,
}) {
  const cfg = readSystemPaymentUpdateTemplateConfig();
  if (!cfg.contentSid) {
    throw new Error(
      "TWILIO_WHATSAPP_SYSTEM_PAYMENT_UPDATE_CONTENT_SID is required for system payment template delivery.",
    );
  }

  const paymentTypeValue = String(paymentType || "").trim();
  const amountValue = String(amount || "").trim();
  const referenceValue = String(referenceOrMilestone || "").trim();
  const actionUrlValue = String(actionUrl || "").trim();

  if (!paymentTypeValue || !amountValue || !referenceValue || !actionUrlValue) {
    throw new Error(
      "System payment update template requires paymentType, amount, referenceOrMilestone, and actionUrl.",
    );
  }

  return sendWhatsAppMessage({
    toE164,
    contentSid: cfg.contentSid,
    contentVariables: {
      1: paymentTypeValue,
      2: amountValue,
      3: referenceValue,
      4: actionUrlValue,
    },
  });
}

/**
 * Send "system_review_notification" using a WhatsApp content template.
 * Variables:
 *  1 = reviewer name, 2 = rating (digits only for "{{2}}-star" in template), 3 = project title, 4 = action URL
 */
export async function sendWhatsAppSystemReviewNotificationTemplate({
  toE164,
  reviewerName,
  rating,
  projectTitle,
  actionUrl,
}) {
  const cfg = readSystemReviewNotificationTemplateConfig();
  if (!cfg.contentSid) {
    throw new Error(
      "TWILIO_WHATSAPP_SYSTEM_REVIEW_NOTIFICATION_CONTENT_SID is required for system review template delivery.",
    );
  }

  const reviewerNameValue = String(reviewerName || "").trim();
  /** Template body uses "{{2}}-star" — must be digits only (e.g. 5), not "5 stars". */
  const rawRating = String(rating ?? "").trim();
  const ratingDigits = rawRating.replace(/\D/g, "").slice(0, 2);
  const ratingValue = ratingDigits || "5";
  const projectTitleValue = String(projectTitle || "").trim();
  const actionUrlValue = String(actionUrl || "").trim();

  if (!reviewerNameValue || !projectTitleValue || !actionUrlValue) {
    throw new Error(
      "System review notification template requires reviewerName, rating, projectTitle, and actionUrl.",
    );
  }

  return sendWhatsAppMessage({
    toE164,
    contentSid: cfg.contentSid,
    contentVariables: {
      1: reviewerNameValue,
      2: ratingValue,
      3: projectTitleValue,
      4: actionUrlValue,
    },
  });
}

/**
 * Send "system_dispute_notification" using a WhatsApp content template.
 * Variables:
 *  1 = project title, 2 = dispute status, 3 = short reason, 4 = action URL
 */
export async function sendWhatsAppSystemDisputeNotificationTemplate({
  toE164,
  projectTitle,
  disputeStatus,
  shortReason,
  actionUrl,
}) {
  const cfg = readSystemDisputeNotificationTemplateConfig();
  if (!cfg.contentSid) {
    throw new Error(
      "TWILIO_WHATSAPP_SYSTEM_DISPUTE_NOTIFICATION_CONTENT_SID is required for system dispute template delivery.",
    );
  }

  const projectTitleValue = String(projectTitle || "").trim();
  const disputeStatusValue = String(disputeStatus || "").trim();
  const shortReasonValue = String(shortReason || "").trim();
  const actionUrlValue = String(actionUrl || "").trim();

  if (!projectTitleValue || !disputeStatusValue || !shortReasonValue || !actionUrlValue) {
    throw new Error(
      "System dispute notification template requires projectTitle, disputeStatus, shortReason, and actionUrl.",
    );
  }

  return sendWhatsAppMessage({
    toE164,
    contentSid: cfg.contentSid,
    contentVariables: {
      1: projectTitleValue,
      2: disputeStatusValue,
      3: shortReasonValue,
      4: actionUrlValue,
    },
  });
}

/**
 * Send "proposal_update" using a WhatsApp content template.
 * Variables:
 *  1 = project title, 2 = proposal status, 3 = amount/reason, 4 = action URL
 */
export async function sendWhatsAppProposalUpdateTemplate({
  toE164,
  projectTitle,
  proposalStatus,
  amountOrReason,
  actionUrl,
}) {
  const cfg = readProposalUpdateTemplateConfig();
  if (!cfg.contentSid) {
    throw new Error(
      "TWILIO_WHATSAPP_PROPOSAL_UPDATE_CONTENT_SID is required for proposal update template delivery.",
    );
  }

  const projectTitleValue = String(projectTitle || "").trim();
  const proposalStatusValue = String(proposalStatus || "").trim();
  const amountOrReasonValue = String(amountOrReason || "").trim();
  const actionUrlValue = String(actionUrl || "").trim();

  if (!projectTitleValue || !proposalStatusValue || !amountOrReasonValue || !actionUrlValue) {
    throw new Error(
      "Proposal update template requires projectTitle, proposalStatus, amountOrReason, and actionUrl.",
    );
  }

  return sendWhatsAppMessage({
    toE164,
    contentSid: cfg.contentSid,
    contentVariables: {
      1: projectTitleValue,
      2: proposalStatusValue,
      3: amountOrReasonValue,
      4: actionUrlValue,
    },
  });
}

/**
 * Send "milestone_update" using a WhatsApp content template.
 * Variables:
 *  1 = project title, 2 = milestone title, 3 = update type, 4 = action URL
 */
export async function sendWhatsAppMilestoneUpdateTemplate({
  toE164,
  projectTitle,
  milestoneTitle,
  updateType,
  actionUrl,
}) {
  const cfg = readMilestoneUpdateTemplateConfig();
  if (!cfg.contentSid) {
    throw new Error(
      "TWILIO_WHATSAPP_MILESTONE_UPDATE_CONTENT_SID is required for milestone update template delivery.",
    );
  }

  const projectTitleValue = String(projectTitle || "").trim();
  const milestoneTitleValue = String(milestoneTitle || "").trim();
  const updateTypeValue = String(updateType || "").trim();
  const actionUrlValue = String(actionUrl || "").trim();

  if (!projectTitleValue || !milestoneTitleValue || !updateTypeValue || !actionUrlValue) {
    throw new Error(
      "Milestone update template requires projectTitle, milestoneTitle, updateType, and actionUrl.",
    );
  }

  return sendWhatsAppMessage({
    toE164,
    contentSid: cfg.contentSid,
    contentVariables: {
      1: projectTitleValue,
      2: milestoneTitleValue,
      3: updateTypeValue,
      4: actionUrlValue,
    },
  });
}

/**
 * Send "copy_milestone_update" using a WhatsApp content template.
 * Variables:
 *  1 = project title, 2 = milestone title, 3 = update type, 4 = action URL
 */
export async function sendWhatsAppCopyMilestoneUpdateTemplate({
  toE164,
  projectTitle,
  milestoneTitle,
  updateType,
  actionUrl,
}) {
  const cfg = readCopyMilestoneUpdateTemplateConfig();
  if (!cfg.contentSid) {
    throw new Error(
      "TWILIO_WHATSAPP_COPY_MILESTONE_UPDATE_CONTENT_SID is required for copy milestone update template delivery.",
    );
  }

  const projectTitleValue = String(projectTitle || "").trim();
  const milestoneTitleValue = String(milestoneTitle || "").trim();
  const updateTypeValue = String(updateType || "").trim();
  const actionUrlValue = String(actionUrl || "").trim();

  if (!projectTitleValue || !milestoneTitleValue || !updateTypeValue || !actionUrlValue) {
    throw new Error(
      "Copy milestone update template requires projectTitle, milestoneTitle, updateType, and actionUrl.",
    );
  }

  return sendWhatsAppMessage({
    toE164,
    contentSid: cfg.contentSid,
    contentVariables: {
      1: projectTitleValue,
      2: milestoneTitleValue,
      3: updateTypeValue,
      4: actionUrlValue,
    },
  });
}

/**
 * Send "kyc_update" using a WhatsApp content template.
 * Variables:
 *  1 = KYC status, 2 = short note, 3 = action URL
 */
export async function sendWhatsAppKycUpdateTemplate({
  toE164,
  kycStatus,
  shortNote,
  actionUrl,
}) {
  const cfg = readKycUpdateTemplateConfig();
  if (!cfg.contentSid) {
    throw new Error(
      "TWILIO_WHATSAPP_KYC_UPDATE_CONTENT_SID is required for KYC update template delivery.",
    );
  }

  const kycStatusValue = String(kycStatus || "").trim();
  const shortNoteValue = String(shortNote || "").trim();
  const actionUrlValue = String(actionUrl || "").trim();

  if (!kycStatusValue || !shortNoteValue || !actionUrlValue) {
    throw new Error(
      "KYC update template requires kycStatus, shortNote, and actionUrl.",
    );
  }

  return sendWhatsAppMessage({
    toE164,
    contentSid: cfg.contentSid,
    contentVariables: {
      1: kycStatusValue,
      2: shortNoteValue,
      3: actionUrlValue,
    },
  });
}
