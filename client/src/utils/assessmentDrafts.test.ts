import { describe, expect, it } from "vitest";
import {
  clearAssessmentDraft,
  getAssessmentDraftKey,
  loadAssessmentDraft,
  saveAssessmentDraft,
} from "./assessmentDrafts";

const assessment = {
  patientName: "Synthetic Patient",
  gender: "Female",
  age: 45,
  hypertension: false,
  heartDisease: false,
  smokingHistory: "never",
  bmi: 24.5,
  hba1cLevel: 5.4,
  bloodGlucoseLevel: 96,
};

class MemoryStorage implements Storage {
  private values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

describe("assessment draft storage", () => {
  it("saves and restores a non-expired assessment draft", () => {
    const storage = new MemoryStorage();
    const key = getAssessmentDraftKey("clinician@example.com");

    const saved = saveAssessmentDraft(assessment, { storage, key, ttlMs: 1000 });
    const loaded = loadAssessmentDraft({
      storage,
      key,
      currentTimeMs: Date.parse(saved?.savedAt ?? "") + 500,
    });

    expect(loaded?.data.patientName).toBe("Synthetic Patient");
    expect(loaded?.expiresAt).toBe(saved?.expiresAt);
  });

  it("clears expired drafts instead of returning stale PHI", () => {
    const storage = new MemoryStorage();
    const key = getAssessmentDraftKey("clinician@example.com");

    const saved = saveAssessmentDraft(assessment, { storage, key, ttlMs: 1000 });
    const loaded = loadAssessmentDraft({
      storage,
      key,
      currentTimeMs: Date.parse(saved?.savedAt ?? "") + 1001,
    });

    expect(loaded).toBeNull();
    expect(storage.getItem(key)).toBeNull();
  });

  it("removes a draft when explicitly cleared", () => {
    const storage = new MemoryStorage();
    const key = getAssessmentDraftKey("clinician@example.com");

    saveAssessmentDraft(assessment, { storage, key });
    clearAssessmentDraft({ storage, key });

    expect(loadAssessmentDraft({ storage, key })).toBeNull();
  });
});
