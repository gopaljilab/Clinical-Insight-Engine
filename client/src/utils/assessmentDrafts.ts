import type { AssessmentInput } from "@shared/routes";

const DRAFT_VERSION = 1;
const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24;

export interface AssessmentDraftRecord {
  version: number;
  savedAt: string;
  expiresAt: string;
  data: AssessmentInput;
}

function nowMs() {
  return Date.now();
}

function getStorage(storage?: Storage): Storage | null {
  if (storage) return storage;
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

/**
 * Get Assessment Draft Key.
 * @param userIdOrEmail - The userIdOrEmail parameter.
 * @returns The result of the operation.
 */
export function getAssessmentDraftKey(userIdOrEmail?: string | null): string {
  return `clinical-insight:assessment-draft:${userIdOrEmail || "anonymous"}`;
}

/**
 * Save Assessment Draft.
 * @param data - The data parameter.
 * @param options - The options parameter.
 * @returns The result of the operation.
 */
export function saveAssessmentDraft(
  data: AssessmentInput,
  options: { storage?: Storage; key?: string; ttlMs?: number } = {},
): AssessmentDraftRecord | null {
  const storage = getStorage(options.storage);
  if (!storage) return null;

  const savedAtMs = nowMs();
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const record: AssessmentDraftRecord = {
    version: DRAFT_VERSION,
    savedAt: new Date(savedAtMs).toISOString(),
    expiresAt: new Date(savedAtMs + ttlMs).toISOString(),
    data,
  };

  storage.setItem(options.key ?? getAssessmentDraftKey(), JSON.stringify(record));
  return record;
}

/**
 * Load Assessment Draft.
 * @param options - The options parameter.
 * @returns The result of the operation.
 */
export function loadAssessmentDraft(
  options: { storage?: Storage; key?: string; currentTimeMs?: number } = {},
): AssessmentDraftRecord | null {
  const storage = getStorage(options.storage);
  if (!storage) return null;

  const key = options.key ?? getAssessmentDraftKey();
  const raw = storage.getItem(key);
  if (!raw) return null;

  try {
    const record = JSON.parse(raw) as AssessmentDraftRecord;
    const currentTimeMs = options.currentTimeMs ?? nowMs();
    if (
      record.version !== DRAFT_VERSION ||
      !record.expiresAt ||
      Date.parse(record.expiresAt) <= currentTimeMs
    ) {
      storage.removeItem(key);
      return null;
    }
    return record;
  } catch {
    storage.removeItem(key);
    return null;
  }
}

/**
 * Clear Assessment Draft.
 * @param options - The options parameter.
 * @returns The result of the operation.
 */
export function clearAssessmentDraft(
  options: { storage?: Storage; key?: string } = {},
): void {
  const storage = getStorage(options.storage);
  if (!storage) return;
  storage.removeItem(options.key ?? getAssessmentDraftKey());
}
