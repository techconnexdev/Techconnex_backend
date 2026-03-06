/**
 * Send an email via Resend. If RESEND_API_KEY is set, sends real email.
 * Otherwise logs to console for development.
 */
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendEmail({ to, subject, text, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM || process.env.RESEND_FROM || "TechConnex <onboarding@resend.dev>";

  if (apiKey) {
    const toList = Array.isArray(to) ? to : [to];
    const { data, error } = await resend.emails.send({
      from,
      to: toList,
      subject,
      ...(html ? { html } : { text: text || "" }),
    });

    if (error) {
      console.error("Send email error:", error);
      throw error;
    }
    return data;
  }

  // No API key: log to console (development)
  console.log("📧 [Email - no RESEND_API_KEY configured] To:", to, "| Subject:", subject);
  console.log("   Body:", text || "(html only)");
}

export { sendEmail };
