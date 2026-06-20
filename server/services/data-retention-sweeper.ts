import { getDb } from "../db";
import { assessments, patientUsers, loginAuditLogs, patientAccessAuditLogs } from "@shared/schema";
import { getRetentionDecision, getRetentionPolicyConfig } from "./data-retention-policy";
import { eq } from "drizzle-orm";
import { logger } from "../logger";

export async function runDataRetentionSweep(dryRun: boolean = false): Promise<{
  purgedAssessments: number;
  purgedPatients: number;
  anonymizedAuditLogs: number;
}> {
  const db = getDb();
  const config = getRetentionPolicyConfig();
  const now = new Date();
  
  let purgedAssessments = 0;
  let purgedPatients = 0;
  let anonymizedAuditLogs = 0;

  // 1. Assessments
  const allAssessments = await db.select().from(assessments);
  for (const record of allAssessments) {
    const decision = getRetentionDecision("assessmentRetentionDays", record.createdAt ?? new Date(), { config, now });
    if (decision.action === "purge") {
      if (dryRun) {
        logger.info(`[Dry Run] Would purge assessment ${record.id}`);
      } else {
        await db.delete(assessments).where(eq(assessments.id, record.id));
      }
      purgedAssessments++;
    }
  }

  // 2. Patient Users
  const allPatients = await db.select().from(patientUsers);
  for (const record of allPatients) {
    const decision = getRetentionDecision("patientRetentionDays", record.createdAt ?? new Date(), { config, now });
    if (decision.action === "purge") {
      if (dryRun) {
        logger.info(`[Dry Run] Would purge patient user ${record.id}`);
      } else {
        await db.delete(patientUsers).where(eq(patientUsers.id, record.id));
      }
      purgedPatients++;
    }
  }

  // 3. Login Audit Logs
  const allLoginLogs = await db.select().from(loginAuditLogs);
  for (const record of allLoginLogs) {
    const decision = getRetentionDecision("auditRetentionDays", record.createdAt ?? new Date(), { config, now });
    if (decision.action === "anonymize") {
      if (dryRun) {
        logger.info(`[Dry Run] Would anonymize login audit log ${record.id}`);
      } else {
        await db.update(loginAuditLogs)
          .set({ ipAddress: "REDACTED", userAgent: "REDACTED" })
          .where(eq(loginAuditLogs.id, record.id));
      }
      anonymizedAuditLogs++;
    }
  }

  // 4. Patient Access Audit Logs
  const allAccessLogs = await db.select().from(patientAccessAuditLogs);
  for (const record of allAccessLogs) {
    const decision = getRetentionDecision("auditRetentionDays", record.createdAt ?? new Date(), { config, now });
    if (decision.action === "anonymize") {
      if (dryRun) {
        logger.info(`[Dry Run] Would anonymize patient access audit log ${record.id}`);
      } else {
        await db.update(patientAccessAuditLogs)
          .set({ ipAddress: "REDACTED", userAgent: "REDACTED" })
          .where(eq(patientAccessAuditLogs.id, record.id));
      }
      anonymizedAuditLogs++;
    }
  }

  return { purgedAssessments, purgedPatients, anonymizedAuditLogs };
}
