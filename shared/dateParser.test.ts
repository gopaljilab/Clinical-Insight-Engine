import { describe, it, expect } from "vitest";
import {
  parseClinicalDate,
  extractDatesFromText,
  type ClinicalDateParseResult,
} from "./dateParser";

describe("parseClinicalDate", () => {
  describe("ISO 8601", () => {
    it("parses YYYY-MM-DD as ISO 8601 with confidence 1.0", () => {
      const result = parseClinicalDate("2022-08-10");
      expect(result.date).toBeInstanceOf(Date);
      expect(result.confidence).toBe(1.0);
      expect(result.ambiguous).toBe(false);
      expect(result.isoString).toBe("2022-08-10");
    });

    it("parses YYYY-MM-DDTHH:mm:ssZ with confidence 1.0", () => {
      const result = parseClinicalDate("2022-08-10T14:30:00Z");
      expect(result.confidence).toBe(1.0);
      expect(result.ambiguous).toBe(false);
    });

    it("rejects invalid ISO calendar date with confidence 0", () => {
      const result = parseClinicalDate("2022-13-45");
      expect(result.date).toBeNull();
      expect(result.confidence).toBe(0);
      expect(result.isoString).toBeNull();
    });
  });

  describe("Large-endian YYYY/MM/DD", () => {
    it("parses YYYY/MM/DD with confidence 1.0", () => {
      const result = parseClinicalDate("2022/08/10");
      expect(result.date).toBeInstanceOf(Date);
      expect(result.confidence).toBe(1.0);
      expect(result.ambiguous).toBe(false);
      expect(result.isoString).toBe("2022-08-10");
    });

    it("parses YYYY-MM-DD with dashes (large-endian) with confidence 1.0", () => {
      const result = parseClinicalDate("2022-08-10");
      expect(result.confidence).toBe(1.0);
      expect(result.isoString).toBe("2022-08-10");
    });
  });

  describe("Named-month formats", () => {
    it('parses "DD Mon YYYY" with confidence 1.0', () => {
      const result = parseClinicalDate("10 Aug 2022");
      expect(result.confidence).toBe(1.0);
      expect(result.ambiguous).toBe(false);
      expect(result.isoString).toBe("2022-08-10");
    });

    it('parses "Mon DD, YYYY" with confidence 1.0', () => {
      const result = parseClinicalDate("August 10, 2022");
      expect(result.confidence).toBe(1.0);
      expect(result.ambiguous).toBe(false);
      expect(result.isoString).toBe("2022-08-10");
    });

    it('parses "DD Mon YYYY" with ordinal suffix with confidence 1.0', () => {
      const result = parseClinicalDate("10th Aug 2022");
      expect(result.confidence).toBe(1.0);
      expect(result.isoString).toBe("2022-08-10");
    });

    it("rejects invalid month name with low confidence", () => {
      const result = parseClinicalDate("10 Xyz 2022");
      expect(result.confidence).toBe(0);
    });
  });

  describe("Ambiguous slashed / dashed formats", () => {
    it("returns ambiguous:true when both MM/DD and DD/MM are valid calendar dates", () => {
      // 08/10/2022: US=Aug 10, UK=Oct 8 — both are valid AND differ
      const result = parseClinicalDate("08/10/2022");
      expect(result.confidence).toBe(0.3);
      expect(result.ambiguous).toBe(true);
      expect(result.date).toBeNull();
      expect(result.isoString).toBeNull();
      expect(result.warning).toContain("ambiguous");
    });

    it("interprets 25/12/2022 as DD/MM/YYYY (UK) when only UK is valid", () => {
      // 25/12/2022: UK (25=day, 12=month) is valid; US (25=month) is not valid
      const result = parseClinicalDate("25/12/2022");
      expect(result.confidence).toBe(0.7);
      expect(result.ambiguous).toBe(false);
      expect(result.isoString).toBe("2022-12-25");
    });



    it("returns ambiguous:false (confidence 0) when neither interpretation is valid", () => {
      const result = parseClinicalDate("32/13/2022");
      expect(result.confidence).toBe(0);
      expect(result.ambiguous).toBe(false);
    });

    it("handles dashed separator A-B-YYYY the same as slashed", () => {
      const result = parseClinicalDate("25-12-2022");
      expect(result.confidence).toBe(0.7);
      expect(result.ambiguous).toBe(false);
    });
  });

  describe("Unrecognised formats", () => {
    it("returns confidence 0 for unrecognised string", () => {
      const result = parseClinicalDate("hello world");
      expect(result.confidence).toBe(0);
      expect(result.date).toBeNull();
      expect(result.ambiguous).toBe(false);
    });

    it("trims whitespace before parsing", () => {
      const result = parseClinicalDate("  2022-08-10  ");
      expect(result.confidence).toBe(1.0);
    });
  });
});

describe("extractDatesFromText", () => {
  it("extracts ISO 8601 dates from clinical note text", () => {
    const text = "Patient seen on 2022-08-10. Follow-up scheduled for 2022-09-15.";
    const results = extractDatesFromText(text);
    expect(results).toHaveLength(2);
    expect(results[0].rawMatch).toBe("2022-08-10");
    expect(results[0].confidence).toBe(1.0);
    expect(results[1].rawMatch).toBe("2022-09-15");
  });

  it("extracts and parses ambiguous dates with correct offsets", () => {
    const text = "Lab work: 06/08/2022.";
    const results = extractDatesFromText(text);
    expect(results).toHaveLength(1);
    expect(results[0].rawMatch).toBe("06/08/2022");
    expect(results[0].offset).toBe(10);
  });

  it("extracts named-month dates", () => {
    const text = "Admitted August 10, 2022.";
    const results = extractDatesFromText(text);
    expect(results).toHaveLength(1);
    expect(results[0].confidence).toBe(1.0);
    expect(results[0].isoString).toBe("2022-08-10");
  });

  it("returns empty array when no dates are found", () => {
    const results = extractDatesFromText("No dates here.");
    expect(results).toHaveLength(0);
  });

  it("extracts multiple dates of different formats from the same text", () => {
    const text = "2022-08-10 and 10 Aug 2022 and 25/12/2022";
    const results = extractDatesFromText(text);
    expect(results).toHaveLength(3);
  });
});
