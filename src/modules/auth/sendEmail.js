/**
 * Send an email. Uses Resend if RESEND_API_KEY is set, otherwise SMTP (nodemailer)
 * if MAIL_HOST, MAIL_USER, MAIL_PASS are set. Otherwise logs and returns false.
 */
import { Resend } from "resend";

let resendClient = null;
function getResend() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  if (!resendClient) resendClient = new Resend(apiKey);
  return resendClient;
}

function hasSmtpConfig() {
  return !!(process.env.MAIL_HOST && process.env.MAIL_USER && process.env.MAIL_PASS);
}

async function sendViaSmtp({ to, subject, text, html }) {
  const nodemailer = await import("nodemailer");
  const from = process.env.MAIL_FROM || process.env.MAIL_USER;
  const transporter = nodemailer.default.createTransport({
    host: process.env.MAIL_HOST,
    port: Number(process.env.MAIL_PORT) || 587,
    secure: process.env.MAIL_SECURE === "true",
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
  });
  const toList = Array.isArray(to) ? to : [to];
  await transporter.sendMail({
    from,
    to: toList,
    subject,
    text: text || undefined,
    html: html || undefined,
  });
}

/**
 * Send an email. Returns true if sent, false if no mail config.
 * Throws on send error.
 */
async function sendEmail({ to, subject, text, html }) {
  const from = process.env.MAIL_FROM || process.env.RESEND_FROM || "TechConnex <onboarding@resend.dev>";
  const bodyText = text || (html ? "" : "");
  const bodyHtml = html || (bodyText ? `<p style="white-space:pre-wrap">${String(bodyText).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")}</p>` : "");

  if (!bodyText && !bodyHtml) {
    console.warn("📧 sendEmail: no content, skipping. To:", to, "Subject:", subject);
    return false;
  }

  const resend = getResend();

  if (resend) {
    const toList = Array.isArray(to) ? to : [to];
    const payload = {
      from,
      to: toList,
      subject,
      ...(bodyText ? { text: bodyText } : {}),
      ...(bodyHtml ? { html: bodyHtml } : {}),
    };
    const { data, error } = await resend.emails.send(payload);
    if (error) {
      console.error("📧 Send email error (Resend):", error?.message || error, "To:", to, "Subject:", subject);
      throw error;
    }
    if (data?.id) {
      console.log("📧 Email sent (Resend). Id:", data.id, "To:", to, "Subject:", subject);
    }
    return true;
  }

  if (hasSmtpConfig()) {
    try {
      await sendViaSmtp({
        to,
        subject,
        text: bodyText || undefined,
        html: bodyHtml || undefined,
      });
      console.log("📧 Email sent (SMTP). To:", to, "Subject:", subject);
      return true;
    } catch (err) {
      console.error("📧 Send email error (SMTP):", err?.message || err, "To:", to, "Subject:", subject);
      throw err;
    }
  }

  console.log("📧 [Email NOT sent - no mail config] To:", to, "| Subject:", subject);
  console.log("   Configure either RESEND_API_KEY or SMTP (MAIL_HOST, MAIL_USER, MAIL_PASS) in .env");
  return false;
}

export { sendEmail };
