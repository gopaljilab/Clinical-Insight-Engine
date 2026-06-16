/**
 * shared/dateParser.test.ts
 *
 * Unit tests for the clinical date parser.
 *
 * Covers:
 *  - ISO 8601 (always unambiguous, confidence 1.0)
 *  - Ambiguous slashed dates where both interpretations are valid (confidence 0.3)
 *  - Disambiguable slashed dates (only one interpretation valid, confidence 0.7)
 *  - Named-month formats (confidence 1.0)
 *  - Invalid / unrecognised inputs (confidence 0.0)
 *  - extractDatesFromText() scanning clinical note prose
 */

import { describe, it, expect } from "vitest";
import { parseClinicalDate, extractDatesFromText } from "./dateParser";

describe("parseClinicalDate", () => {
  // ── ISO 8601 ───────────────────────────────────────────────────────────────
  describe("ISO 8601 input", () => {
    it("accepts YYYY-MM-DD with full confidence", () => {
      const r = parseClinicalDate("2022-08-10");
      expect(r.confidence).toBe(1.0);
      expect(r.ambiguous).toBe(false);
      expect(r.isoString).toBe("2022-08-10");
      expect(r.date).not.toBeNull();
    });

    it("accepts ISO datetime with timezone suffix", () => {
      const r = parseClinicalDate("2023-05-06T14:30:00Z");
      expect(r.confidence).toBe(1.0);
      expect(r.isoString).toBe("2023-05-06");
    });

    it("rejects an ISO-shaped string with an invalid calendar date", () => {
      const r = parseClinicalDate("2022-13-45");
      expect(r.confidence).toBe(0);
      expect(r.date).toBeNull();
    });
  });

  // ── Ambiguous slashed dates ────────────────────────────────────────────────
  describe("ambiguous MM/DD/YYYY vs DD/MM/YYYY", () => {
    it("flags 08/10/2022 as ambiguous (Aug 10 vs Oct 8)", () => {
      const r = parseClinicalDate("08/10/2022");
      expect(r.ambiguous).toBe(true);
      expect(r.confidence).toBe(0.3);
      expect(r.date).toBeNull();
      expect(r.warning).toMatch(/ambiguous/i);
      expect(r.warning).toMatch("2022-08-10");
      expect(r.warning).toMatch("2022-10-08");
    });

    it("flags 12/10/2022 as ambiguous (Dec 10 vs Oct 12)", () => {
      const r = parseClinicalDate("12/10/2022");
      expect(r.ambiguous).toBe(true);
      expect(r.confidence).toBe(0.3);
    });

    it("flags 05/06/2023 as ambiguous (May 6 vs Jun 5)", () => {
      const r = parseClinicalDate("05/06/2023");
      expect(r.ambiguous).toBe(true);
      expect(r.confidence).toBe(0.3);
    });

    it("uses dashes the same way — 08-10-2022 is ambiguous", () => {
      const r = parseClinicalDate("08-10-2022");
      expect(r.ambiguous).toBe(true);
      expect(r.confidence).toBe(0.3);
    });
  });

  // ── Disambiguable slashed dates ────────────────────────────────────────────
  describe("slashed date with only one valid interpretation", () => {
    it("resolves 31/01/2022 as DD/MM/YYYY (day=31 cannot be a month)", () => {
      const r = parseClinicalDate("31/01/2022");
      expect(r.ambiguous).toBe(false);
      expect(r.confidence).toBe(0.7);
      expect(r.isoString).toBe("2022-01-31");
      expect(r.warning).toMatch(/DD\/MM\/YYYY/);
    });

    it("resolves 01/31/2022 as MM/DD/YYYY (second part=31 cannot be a month)", () => {
      const r = parseClinicalDate("01/31/2022");
      expect(r.ambiguous).toBe(false);
      expect(r.confidence).toBe(0.7);
      expect(r.isoString).toBe("2022-01-31");
      expect(r.warning).toMatch(/MM\/DD\/YYYY/);
    });

    it("rejects 32/13/2022 — neither interpretation is valid", () => {
      const r = parseClinicalDate("32/13/2022");
      expect(r.date).toBeNull();
      expect(r.confidence).toBe(0);
    });
  });

  // ── Named-month formats ────────────────────────────────────────────────────
  describe("named-month formats (unambiguous)", () => {
    it("parses '10 Aug 2022'", () => {
      const r = parseClinicalDate("10 Aug 2022");
      expect(r.confidence).toBe(1.0);
      expect(r.isoString).toBe("2022-08-10");
    });

    it("parses 'Aug 10, 2022'", () => {
      const r = parseClinicalDate("Aug 10, 2022");
      expect(r.confidence).toBe(1.0);
      expect(r.isoString).toBe("2022-08-10");
    });

    it("parses '10th August 2022'", () => {
      const r = parseClinicalDate("10th August 2022");
      expect(r.confidence).toBe(1.0);
      expect(r.isoString).toBe("2022-08-10");
    });

    it("parses 'January 1st, 2020'", () => {
      const r = parseClinicalDate("January 1st, 2020");
      expect(r.confidence).toBe(1.0);
      expect(r.isoString).toBe("2020-01-01");
    });
  });

  // ── Invalid / unrecognised ─────────────────────────────────────────────────
  describe("invalid or unrecognised input", () => {
    it("returns confidence 0 for free text", () => {
      const r = parseClinicalDate("not a date");
      expect(r.date).toBeNull();
      expect(r.confidence).toBe(0);
    });

    it("returns confidence 0 for empty string", () => {
      const r = parseClinicalDate("");
      expect(r.date).toBeNull();
      expect(r.confidence).toBe(0);
    });

    it("returns confidence 0 for partial date '08/2022'", () => {
      const r = parseClinicalDate("08/2022");
      expect(r.date).toBeNull();
      expect(r.confidence).toBe(0);
    });
  });
});

// ── extractDatesFromText ───────────────────────────────────────────────────

describe("extractDatesFromText", () => {
  it("extracts both ambiguous dates from the bug-report example", () => {
    const note =
      "Patient previously admitted on 08/10/2022 and 12/10/2022.";
    const extracted = extractDatesFromText(note);

    expect(extracted).toHaveLength(2);

    const [first, second] = extracted;
    expect(first.rawMatch).toBe("08/10/2022");
    expect(first.ambiguous).toBe(true);
    expect(first.confidence).toBe(0.3);

    expect(second.rawMatch).toBe("12/10/2022");
    expect(second.ambiguous).toBe(true);
    expect(second.confidence).toBe(0.3);
  });

  it("extracts ISO dates with full confidence", () => {
    const note = "Follow-up scheduled for 2023-05-06 and discharge on 2023-05-10.";
    const extracted = extractDatesFromText(note);

    expect(extracted).toHaveLength(2);
    expect(extracted[0].isoString).toBe("2023-05-06");
    expect(extracted[0].confidence).toBe(1.0);
    expect(extracted[1].isoString).toBe("2023-05-10");
  });

  it("extracts named-month dates with full confidence", () => {
    const note = "Patient last seen on 15 March 2021 for annual review.";
    const extracted = extractDatesFromText(note);

    expect(extracted).toHaveLength(1);
    expect(extracted[0].isoString).toBe("2021-03-15");
    expect(extracted[0].confidence).toBe(1.0);
  });

  it("returns an empty array for text with no dates", () => {
    expect(extractDatesFromText("No dates here.")).toHaveLength(0);
  });

  it("correctly records the character offset of each match", () => {
    const note = "Admitted 2022-08-10.";
    const extracted = extractDatesFromText(note);
    expect(extracted[0].offset).toBe(9); // "Admitted " is 9 chars
  });
});
