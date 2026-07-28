import nodemailer from "nodemailer";

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    // For production, these should be configured via environment variables.
    // We'll fallback to a mock transport for development if not provided.
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || "587"),
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    } else {
      // Mock transport that just logs to console
      this.transporter = nodemailer.createTransport({
        streamTransport: true,
        newline: "windows",
      });
    }
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    try {
      const info = await this.transporter.sendMail({
        from: process.env.SMTP_FROM || '"Clinical Insight Engine" <noreply@example.com>',
        to: options.to,
        subject: options.subject,
        html: options.html,
      });

      // If using stream transport (mock), log the message
      if (info.message && typeof info.message.pipe === "function") {
        console.log(`[MOCK EMAIL SENT to ${options.to}] Subject: ${options.subject}`);
      } else {
        console.log(`Email sent to ${options.to}: ${info.messageId}`);
      }
    } catch (error) {
      console.error(`Failed to send email to ${options.to}:`, error);
    }
  }
}

export const emailService = new EmailService();
