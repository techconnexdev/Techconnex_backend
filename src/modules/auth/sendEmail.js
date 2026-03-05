/**
 * Send an email. If nodemailer is installed and SMTP is configured (MAIL_HOST, MAIL_USER, MAIL_PASS),
 * sends real email. Otherwise logs to console for development.
 */
async function sendEmail({ to, subject, text }) {
  const useSmtp =
    process.env.MAIL_HOST &&
    process.env.MAIL_USER &&
    process.env.MAIL_PASS;

  if (useSmtp) {
    try {
      const nodemailer = await import("nodemailer");
      const transporter = nodemailer.default.createTransport({
        host: process.env.MAIL_HOST,
        port: Number(process.env.MAIL_PORT) || 587,
        secure: process.env.MAIL_SECURE === "true",
        auth: {
          user: process.env.MAIL_USER,
          pass: process.env.MAIL_PASS,
        },
      });
      await transporter.sendMail({
        from: process.env.MAIL_FROM || process.env.MAIL_USER,
        to,
        subject,
        text,
      });
      return;
    } catch (err) {
      console.error("Send email error:", err);
      throw err;
    }
  }

  // No SMTP: log to console (development)
  console.log("📧 [Email OTP - no SMTP configured] To:", to, "| Subject:", subject);
  console.log("   OTP / body:", text);
}

export { sendEmail };
