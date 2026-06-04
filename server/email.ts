/**
 * Email service for the Clinical Insight Engine.
 *
 * Development: prints OTP to the server console.
 * Production: sends via SMTP (SendGrid, AWS SES, Mailgun, or Gmail SMTP).
 */

const FROM_ADDRESS = process.env.EMAIL_FROM || "noreply@clinicalinsight.dev";
import { logger } from "./logger";

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
  logger.info({ email, code }, "EMAIL VERIFICATION OTP");
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
    } catch (err) {
      logger.warn({ err }, "SMTP not available — falling back to mock log.");
      logger.info({ email: options }, "MOCK EMAIL SENT");
    }
  } else {
    logger.info({ email: options }, "MOCK EMAIL SENT");
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
  if (process.env.NODE_ENV !== "production") {
    logDevOtp(email, code);
  }

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

/**
 * Sends a critical risk email alert to the designated doctor.
 */
export async function sendCriticalRiskAlert(
  email: string,
  patientName: string,
  riskScore: number,
  assessmentId: number,
): Promise<void> {
  const formattedScore = riskScore.toFixed(1);
  const subject = `CRITICAL ALERT: Critical Diabetes Risk Score Detected for ${patientName}`;
  const text = `Dear Clinician,\n\nA new clinical assessment has calculated a critical risk score of ${formattedScore}% for patient: ${patientName}.\n\nPlease review the patient's record (Assessment ID: ${assessmentId}) immediately.\n\nBest regards,\nClinical Insight Engine`;
  const html = `
    <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; border: 1px solid #FECACA; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
      <div style="background-color: #EF4444; color: white; padding: 20px; text-align: center;">
        <h2 style="margin: 0; font-size: 20px; font-weight: 800; letter-spacing: 0.5px;">CRITICAL RISK ALERT</h2>
      </div>
      <div style="padding: 24px; color: #1E293B;">
        <p style="font-size: 16px; margin-top: 0;">Dear Clinician,</p>
        <p>A new clinical assessment has flagged a patient with a critical risk score:</p>
        
        <div style="background: #FEF2F2; border: 1px solid #FEE2E2; border-radius: 10px; padding: 18px; margin: 20px 0; text-align: center;">
          <p style="margin: 0 0 6px 0; font-size: 11px; font-weight: 700; text-transform: uppercase; color: #DC2626; letter-spacing: 1px;">Calculated Risk Score</p>
          <p style="margin: 0; font-size: 36px; font-weight: 900; color: #DC2626;">${formattedScore}%</p>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr style="border-bottom: 1px solid #E2E8F0;">
            <td style="padding: 8px 0; font-weight: 700; color: #475569; width: 40%;">Patient Name:</td>
            <td style="padding: 8px 0; color: #1E293B;">${patientName}</td>
          </tr>
          <tr style="border-bottom: 1px solid #E2E8F0;">
            <td style="padding: 8px 0; font-weight: 700; color: #475569;">Assessment ID:</td>
            <td style="padding: 8px 0; color: #1E293B;">${assessmentId}</td>
          </tr>
        </table>

        <p style="line-height: 1.5; color: #475569;">
          Please log in to the dashboard to review the patient's full vital stats, history, and model recommendations immediately.
        </p>
      </div>
      <div style="background: #F8FAFC; border-top: 1px solid #E2E8F0; padding: 14px 24px; text-align: center; font-size: 11px; color: #64748B;">
        This is an automated alert system from Clinical Insight Engine.
      </div>
    </div>
  `;

  if (process.env.NODE_ENV !== "production") {
    const border = "!".repeat(50);
    logger.info(`\n${border}`);
    logger.info("  CRITICAL RISK ALERT MOCK LOG");
    logger.info(`  To: ${email}`);
    logger.info(`  Patient: ${patientName}`);
    logger.info(`  Risk Score: ${formattedScore}%`);
    logger.info(`  Assessment ID: ${assessmentId}`);
    logger.info(`${border}\n`);
  }

  await sendEmail({
    to: email,
    subject,
    text,
    html,
  });
}

