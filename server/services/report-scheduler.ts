import cron from "node-cron";
import { getDb } from "../db";
import { users, assessments } from "@shared/schema";
import { eq, gte } from "drizzle-orm";
import { emailService } from "./email.service";

class ReportScheduler {
  constructor() {
    // We do not schedule immediately on import. Call init() from the app.
  }

  public init() {
    // Schedule Daily Report - runs at 8:00 AM every day
    cron.schedule("0 8 * * *", () => {
      this.generateAndSendReports("daily");
    });

    // Schedule Weekly Report - runs at 8:00 AM every Monday
    cron.schedule("0 8 * * 1", () => {
      this.generateAndSendReports("weekly");
    });

    console.log("Report Scheduler initialized (cron jobs registered).");
  }

  private async generateAndSendReports(frequency: "daily" | "weekly") {
    console.log(`Starting ${frequency} summary report generation...`);
    try {
      const db = getDb();
      // 1. Fetch users subscribed to this frequency
      const subscribedUsers = await db
        .select()
        .from(users)
        .where(eq(users.reportFrequency, frequency));

      if (subscribedUsers.length === 0) {
        console.log(`No users subscribed for ${frequency} reports.`);
        return;
      }

      // 2. Fetch metrics for the required time window
      const now = new Date();
      const pastDate = new Date();
      if (frequency === "daily") {
        pastDate.setDate(now.getDate() - 1);
      } else {
        pastDate.setDate(now.getDate() - 7);
      }

      const recentAssessments = await db
        .select()
        .from(assessments)
        .where(gte(assessments.createdAt, pastDate));

      const totalAssessments = recentAssessments.length;
      const highRiskAssessments = recentAssessments.filter(
        (a) => (a.riskCategory || "").toUpperCase() === "HIGH"
      ).length;

      // 3. Format the email
      const timeframeStr = frequency === "daily" ? "Past 24 Hours" : "Past 7 Days";
      
      const emailHtml = `
        <div style="font-family: sans-serif; max-w: 600px; margin: 0 auto; color: #333;">
          <h2 style="color: #2563eb;">Clinical Insight Engine - ${frequency.charAt(0).toUpperCase() + frequency.slice(1)} Summary</h2>
          <p>Here is the high-level patient cohort statistics for the ${timeframeStr.toLowerCase()}:</p>
          
          <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <ul style="list-style: none; padding: 0; margin: 0; font-size: 16px;">
              <li style="margin-bottom: 10px;"><strong>Total Assessments:</strong> ${totalAssessments}</li>
              <li style="margin-bottom: 10px;"><strong>New High-Risk Patients:</strong> ${highRiskAssessments}</li>
              <li><strong>Cohort Trend:</strong> ${
                highRiskAssessments > (totalAssessments * 0.5) 
                  ? "<span style='color: #dc2626;'>Action Required</span>" 
                  : "<span style='color: #16a34a;'>Stable</span>"
              }</li>
            </ul>
          </div>
          
          <p style="font-size: 12px; color: #6b7280; margin-top: 30px;">
            You are receiving this email because your report frequency is set to ${frequency}.
            To change this, visit the Settings panel in the Clinical Insight Engine dashboard.
          </p>
        </div>
      `;

      const emailSubject = `[Clinical Insight Engine] ${frequency.charAt(0).toUpperCase() + frequency.slice(1)} Summary Report`;

      // 4. Send the emails
      for (const user of subscribedUsers) {
        await emailService.sendEmail({
          to: user.email,
          subject: emailSubject,
          html: emailHtml,
        });
      }

      console.log(`Successfully sent ${frequency} reports to ${subscribedUsers.length} users.`);
    } catch (error) {
      console.error(`Error generating ${frequency} reports:`, error);
    }
  }
}

export const reportScheduler = new ReportScheduler();
