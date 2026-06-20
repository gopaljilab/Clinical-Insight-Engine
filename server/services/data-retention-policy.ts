const DAY_MS = 1000 * 60 * 60 * 24;

export type RetentionAction = "retain" | "anonymize" | "purge";

export interface RetentionPolicyConfig {
  assessmentRetentionDays: number;
  patientRetentionDays: number;
  exportRetentionDays: number;
  auditRetentionDays: number;
}

export interface RetentionDecision {
  action: RetentionAction;
  eligibleAt: Date;
  reason: string;
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Get Retention Policy Config.
 * @param env - The env parameter.
 * @returns The result of the operation.
 */
export function getRetentionPolicyConfig(env: NodeJS.ProcessEnv = process.env): RetentionPolicyConfig {
  return {
    assessmentRetentionDays: parsePositiveInt(env.ASSESSMENT_RETENTION_DAYS, 365 * 7),
    patientRetentionDays: parsePositiveInt(env.PATIENT_RETENTION_DAYS, 365 * 7),
    exportRetentionDays: parsePositiveInt(env.EXPORT_RETENTION_DAYS, 30),
    auditRetentionDays: parsePositiveInt(env.AUDIT_RETENTION_DAYS, 365 * 10),
  };
}

/**
 * Add Days.
 * @param date - The date parameter.
 * @param days - The days parameter.
 * @returns The result of the operation.
 */
export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/**
 * Checks if  retention eligible.
 * @param createdAt - The createdAt parameter.
 * @param retentionDays - The retentionDays parameter.
 * @param now - The now parameter.
 * @returns The result of the operation.
 */
export function isRetentionEligible(
  createdAt: Date,
  retentionDays: number,
  now: Date = new Date(),
): boolean {
  return addDays(createdAt, retentionDays).getTime() <= now.getTime();
}

/**
 * Get Retention Decision.
 * @param recordType - The recordType parameter.
 * @param createdAt - The createdAt parameter.
 * @param options - The options parameter.
 * @returns The result of the operation.
 */
export function getRetentionDecision(
  recordType: keyof RetentionPolicyConfig,
  createdAt: Date,
  options: {
    config?: RetentionPolicyConfig;
    now?: Date;
    hasLegalHold?: boolean;
  } = {},
): RetentionDecision {
  const config = options.config ?? getRetentionPolicyConfig();
  const retentionDays = config[recordType];
  const eligibleAt = addDays(createdAt, retentionDays);

  if (options.hasLegalHold) {
    return {
      action: "retain",
      eligibleAt,
      reason: "Record is under legal or clinical hold.",
    };
  }

  if (eligibleAt.getTime() > (options.now ?? new Date()).getTime()) {
    return {
      action: "retain",
      eligibleAt,
      reason: "Record has not reached its configured retention window.",
    };
  }

  return {
    action: recordType === "auditRetentionDays" ? "anonymize" : "purge",
    eligibleAt,
    reason: "Record has reached its configured retention window.",
  };
}
