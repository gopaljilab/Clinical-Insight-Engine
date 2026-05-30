/**
 * Email service for the Clinical Insight Engine.
 *
 * Development: prints OTP to the server console.
 * Production: sends via SMTP (SendGrid, AWS SES, Mailgun, or Gmail SMTP).
 */

const FROM_ADDRESS = process.env.EMAIL_FROM || "noreply@clinicalinsight.dev";

interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Logs a visible OTP block to the console in development.
 */
function logDevOtp(email: string, code: string): void {
  const border = "=".repeat(44);
  console.log(`\n${border}`);
  console.log("  EMAIL VERIFICATION");
  console.log(`  To: ${email}`);
  console.log(`  Verification Code: ${code}`);
  console.log(`${border}\n`);
}

/**
 * Sends an email using the configured SMTP transport in production.
 * Falls back to console logging if no SMTP is configured.
 */
async function sendEmail(options: EmailOptions): Promise<void> {
  if (process.env.SMTP_HOST && process.env.SMTP_PORT) {
    try {
      // Dynamic import — SMTP deps are optional, may not be installed
      const { createTransport } = await import("nodemailer") as typeof import("nodemailer");

      const transporter = createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT, 10),
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      await transporter.sendMail({
        from: FROM_ADDRESS,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });
    } catch {
      console.warn("SMTP not available — falling back to console log.");
      console.log(`\n  [EMAIL] To: ${options.to}`);
      console.log(`  [EMAIL] Subject: ${options.subject}`);
      console.log(`  [EMAIL] Body: ${options.text}\n`);
    }
  } else {
    console.log(`\n  [EMAIL] To: ${options.to}`);
    console.log(`  [EMAIL] Subject: ${options.subject}`);
    console.log(`  [EMAIL] Body: ${options.text}\n`);
  }
}

/**
 * Sends a 6-digit verification code to the given email address.
 * In development, also logs the code prominently to the console.
 */
export async function sendVerificationCode(
  email: string,
  code: string,
): Promise<void> {
  logDevOtp(email, code);

  await sendEmail({
    to: email,
    subject: "Your Clinical Insight Engine Verification Code",
    text: `Your verification code is: ${code}\n\nThis code expires in 10 minutes.\n\nIf you did not request this code, please ignore this email.`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #2563EB;">Clinical Insight Engine</h2>
        <p>Your verification code is:</p>
        <div style="font-size: 32px; font-weight: 900; letter-spacing: 8px; text-align: center;
                    padding: 16px; background: #F0F5FF; border-radius: 12px; color: #1E293B; margin: 24px 0;">
          ${code}
        </div>
        <p style="color: #64748B; font-size: 14px;">
          This code expires in 10 minutes.<br/>
          If you did not request this code, please ignore this email.
        </p>
      </div>
    `,
  });
}
