const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_PATTERN = /\b(?:\+?\d{1,3}[\s-.])?(?:\(?\d{2,4}\)?[\s-.]?){1,3}\d{2,4}\b/g;
const ADDRESS_PATTERN = /\b\d{1,5}\s+[A-Za-z0-9]+(?:\s+[A-Za-z0-9]+){0,4}\s+(?:Street|St|Avenue|Ave|Boulevard|Blvd|Road|Rd|Lane|Ln|Drive|Dr|Court|Ct|Way|Terrace|Ter|Place|Pl)\b(?:,?\s*[A-Za-z\s]+){0,2}/gi;
const NAME_FIELD_PATTERN = /^(patientName|fullName|firstName|lastName|patient_name|full_name|givenName|familyName)$/i;
const PHI_FIELD_PATTERN = /^(patientName|fullName|firstName|lastName|patient_name|full_name|givenName|familyName|email|phone|fax|address|street|city|state|zip|postalCode|ssn|dob)$/i;

export const PHI_PLACEHOLDERS = {
  PATIENT_NAME: "[REDACTED_PATIENT_NAME]",
  EMAIL: "[REDACTED_EMAIL]",
  PHONE: "[REDACTED_PHONE]",
  ADDRESS: "[REDACTED_ADDRESS]",
};

export function isPhiRedactionEnabled(): boolean {
  const raw = process.env.ENABLE_PHI_REDACTION;
  if (!raw || raw.trim() === "") {
    return true;
  }
  return raw.toLowerCase() !== "false";
}

function redactString(value: string, key?: string, options?: { preservePatientName?: boolean }): string {
  if (key && NAME_FIELD_PATTERN.test(key)) {
    return options?.preservePatientName ? value : PHI_PLACEHOLDERS.PATIENT_NAME;
  }

  let redacted = value;

  redacted = redacted.replace(EMAIL_PATTERN, PHI_PLACEHOLDERS.EMAIL);
  redacted = redacted.replace(PHONE_PATTERN, PHI_PLACEHOLDERS.PHONE);
  redacted = redacted.replace(ADDRESS_PATTERN, PHI_PLACEHOLDERS.ADDRESS);

  if (key && PHI_FIELD_PATTERN.test(key) && typeof value === "string") {
    const normalized = value.trim();
    if (normalized.length > 0 && normalized.length <= 100) {
      if (NAME_FIELD_PATTERN.test(key) && !options?.preservePatientName) {
        return PHI_PLACEHOLDERS.PATIENT_NAME;
      }
      if (/email/i.test(key)) {
        return PHI_PLACEHOLDERS.EMAIL;
      }
      if (/phone|fax/i.test(key)) {
        return PHI_PLACEHOLDERS.PHONE;
      }
      if (/address|street|city|state|zip|postalCode/i.test(key)) {
        return PHI_PLACEHOLDERS.ADDRESS;
      }
    }
  }

  return redacted;
}

function redactValue(value: unknown, key?: string, options?: { preservePatientName?: boolean }): unknown {
  if (typeof value === "string") {
    return redactString(value, key, options);
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, key, options));
  }

  if (value && typeof value === "object") {
    return redactRecord(value as Record<string, unknown>, options);
  }

  return value;
}

export function redactRecord<T extends Record<string, unknown>>(
  record: T,
  options: { preservePatientName?: boolean } = {},
): T {
  if (!isPhiRedactionEnabled()) {
    return record;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    result[key] = redactValue(value, key, options);
  }

  return result as T;
}

export function redactForStorage<T extends Record<string, unknown>>(record: T): T {
  return redactRecord(record, { preservePatientName: true });
}

export function redactForApi<T extends Record<string, unknown>>(record: T): T {
  return redactRecord(record, { preservePatientName: false });
}
