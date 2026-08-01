import { getDb } from "../db";
import { alertRules, alerts, users, type InsertAssessment } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { emailService } from "./email.service";
import { logger } from "../logger";

export class AlertService {
  /**
   * Evaluates new assessments against the alert rules configured by the clinician.
   * If thresholds are breached, it generates notifications and sends an aggregated email.
   * 
   * @param records Array of newly inserted assessments
   * @param clinicianId The UUID of the clinician (owner of the records)
   */
  static async checkAndGenerateAlerts(records: InsertAssessment[], clinicianId: string) {
    if (!records || records.length === 0) return;

    try {
      const db = getDb();
      
      // Fetch active alert rules for this clinician
      const activeRules = await db.query.alertRules.findMany({
        where: and(eq(alertRules.clinicianId, clinicianId), eq(alertRules.isActive, true)),
      });

      if (activeRules.length === 0) return;

      const generatedAlerts: { patientName: string; message: string }[] = [];

      for (const record of records) {
        for (const rule of activeRules) {
          // If the rule specifies a patient, it must match
          if (rule.patientName && rule.patientName !== record.patientName) {
            continue;
          }

          // Evaluate condition
          const recordValue = (record as any)[rule.biomarker];
          if (recordValue === undefined || recordValue === null) continue;

          let isBreached = false;
          switch (rule.condition) {
            case ">":
            case "greater_than":
              isBreached = recordValue > rule.thresholdValue;
              break;
            case "<":
            case "less_than":
              isBreached = recordValue < rule.thresholdValue;
              break;
            case "=":
            case "equals":
              isBreached = recordValue === rule.thresholdValue;
              break;
            case ">=":
              isBreached = recordValue >= rule.thresholdValue;
              break;
            case "<=":
              isBreached = recordValue <= rule.thresholdValue;
              break;
            default:
              break;
          }

          if (isBreached) {
            const message = `Alert: Patient ${record.patientName}'s ${rule.biomarker} is ${recordValue}, which is ${rule.condition} the threshold of ${rule.thresholdValue}.`;
            
            // Insert alert into DB
            await db.insert(alerts).values({
              clinicianId,
              patientName: record.patientName,
              assessmentId: undefined, // Assessment ID is not known if inserting from batch without RETURNING all IDs easily, but can be set if passed
              message,
            });

            generatedAlerts.push({
              patientName: record.patientName,
              message,
            });
          }
        }
      }

      // If any alerts were generated, send an aggregated email to the clinician
      if (generatedAlerts.length > 0) {
        const clinician = await db.query.users.findFirst({
          where: eq(users.id, clinicianId),
        });

        if (clinician && clinician.email) {
          const emailHtml = `
            <h2>Biomarker Alerts Triggered</h2>
            <p>The following new records breached your configured biomarker thresholds:</p>
            <ul>
              ${generatedAlerts.map(a => `<li><strong>${a.patientName}</strong>: ${a.message}</li>`).join("")}
            </ul>
            <p>Please log in to the dashboard to review these alerts.</p>
          `;

          await emailService.sendEmail({
            to: clinician.email,
            subject: `Clinical Insight Engine - ${generatedAlerts.length} New Biomarker Alert(s)`,
            html: emailHtml,
          });
          logger.info(`Sent batch alert email to ${clinician.email} for ${generatedAlerts.length} alerts.`);
        }
      }
    } catch (error) {
      logger.error({ error }, "Error evaluating custom alerts");
    }
  }
}
