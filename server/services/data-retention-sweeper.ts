import { getRetentionDecision, getRetentionPolicyConfig } from "./data-retention-policy";
import { logger } from "../logger";
import { AssessmentRepository } from "../repositories/assessment.repository";
import { PatientUserRepository } from "../repositories/patient-user.repository";
import { AuditRepository } from "../repositories/audit.repository";

const assessmentRepo = new AssessmentRepository();
const patientUserRepo = new PatientUserRepository();
const auditRepo = new AuditRepository();

export interface SweepResult {
  assessmentsPurged: number;
  patientUsersAnonymized: number;
  patientUsersPurged: number;
  loginAuditLogsAnonymized: number;
  patientAccessAuditLogsPurged: number;
}

export async function runRetentionSweep(dryRun: boolean = process.env.DRY_RUN === "true"): Promise<SweepResult> {
  const config = getRetentionPolicyConfig();
  const now = new Date();
  const result: SweepResult = {
    assessmentsPurged: 0,
    patientUsersAnonymized: 0,
    patientUsersPurged: 0,
    loginAuditLogsAnonymized: 0,
    patientAccessAuditLogsPurged: 0,
  };

  const assessmentCutoff = new Date(now.getTime() - config.assessmentRetentionDays * 24 * 60 * 60 * 1000);
  const decision = getRetentionDecision("assessmentRetentionDays", assessmentCutoff);
  if (decision.action === "purge") {
    const oldAssessments = await assessmentRepo.findAssessmentsOlderThan(assessmentCutoff);
    if (oldAssessments.length > 0) {
      if (!dryRun) {
        result.assessmentsPurged = await assessmentRepo.purgeAssessmentsOlderThan(assessmentCutoff);
      } else {
        result.assessmentsPurged = oldAssessments.length;
      }
      logger.info(
        { count: result.assessmentsPurged, dryRun, retentionDays: config.assessmentRetentionDays },
        "Assessment retention sweep",
      );
    }
  }

  const patientCutoff = new Date(now.getTime() - config.patientRetentionDays * 24 * 60 * 60 * 1000);
  const patientAnonDecision = getRetentionDecision("patientRetentionDays", patientCutoff);
  if (patientAnonDecision.action !== "retain") {
    if (!dryRun) {
      result.patientUsersAnonymized = await patientUserRepo.anonymizePatientUsersOlderThan(patientCutoff);
    }
    logger.info(
      { count: result.patientUsersAnonymized, dryRun, retentionDays: config.patientRetentionDays, action: patientAnonDecision.action },
      "Patient user retention sweep",
    );
  }

  const auditCutoff = new Date(now.getTime() - config.auditRetentionDays * 24 * 60 * 60 * 1000);
  const auditDecision = getRetentionDecision("auditRetentionDays", auditCutoff);
  if (auditDecision.action === "anonymize") {
    if (!dryRun) {
      result.loginAuditLogsAnonymized = await auditRepo.anonymizeLoginAuditLogsOlderThan(auditCutoff);
    }
    logger.info(
      { count: result.loginAuditLogsAnonymized, dryRun, retentionDays: config.auditRetentionDays },
      "Login audit log retention sweep",
    );
  }

  const exportCutoff = new Date(now.getTime() - config.exportRetentionDays * 24 * 60 * 60 * 1000);
  const exportDecision = getRetentionDecision("exportRetentionDays", exportCutoff);
  if (exportDecision.action === "purge") {
    if (!dryRun) {
      result.patientAccessAuditLogsPurged = await auditRepo.purgePatientAccessAuditLogsOlderThan(exportCutoff);
    }
    logger.info(
      { count: result.patientAccessAuditLogsPurged, dryRun, retentionDays: config.exportRetentionDays },
      "Patient access audit log retention sweep",
    );
  }

  return result;
}

export function startRetentionSweeper(intervalMs: number = 24 * 60 * 60 * 1000): ReturnType<typeof setInterval> {
  logger.info({ intervalMs }, "Starting data retention sweeper");

  runRetentionSweep().catch((err) => {
    logger.error({ err }, "Initial retention sweep failed");
  });

  return setInterval(() => {
    runRetentionSweep().catch((err) => {
      logger.error({ err }, "Scheduled retention sweep failed");
    });
  }, intervalMs);
}
