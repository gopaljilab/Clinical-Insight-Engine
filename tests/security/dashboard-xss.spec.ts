import { describe, it, expect } from "vitest";
import { validateFilterInput } from "../../client/src/validation/filterValidation";
import { getSafeQueryParam, encodeHtmlEntities } from "../../client/src/utils/safeQueryParams";

describe("Dashboard XSS Protections", () => {
  describe("validateFilterInput", () => {
    it("Scenario 1: allows normal filter values", () => {
      expect(validateFilterInput("normal text search 123")).toBe("normal text search 123");
    });

    it("Scenario 2: rejects <script> payloads", () => {
      expect(validateFilterInput("<script>alert(1)</script>")).toBe("");
      expect(validateFilterInput("something <script>alert(1)</script> else")).toBe("");
    });

    it("Scenario 3: rejects onerror payloads", () => {
      expect(validateFilterInput("<img src=x onerror=alert(1)>")).toBe("");
    });

    it("Scenario 4: rejects SVG payloads", () => {
      expect(validateFilterInput("<svg/onload=alert(1)>")).toBe("");
    });
    
    it("rejects javascript: pseudo-protocols", () => {
      expect(validateFilterInput("javascript:alert(1)")).toBe("");
    });
  });

  describe("encodeHtmlEntities", () => {
    it("Scenario 5: safely encodes potentially dangerous characters", () => {
      const input = "<>\"'&";
      const expected = "&lt;&gt;&quot;&#39;&amp;";
      expect(encodeHtmlEntities(input)).toBe(expected);
    });

    it("does not alter safe strings", () => {
      expect(encodeHtmlEntities("Safe string 123")).toBe("Safe string 123");
    });
  });

  describe("getSafeQueryParam", () => {
    it("extracts, validates, and encodes parameter from query string", () => {
      // Input has some valid text, but we'll try to inject something that passes validation
      // but needs encoding. E.g., just a lone < bracket without malicious payload tags
      const searchStr = "?filter=john%20<doe>&other=1";
      const safe = getSafeQueryParam(searchStr, "filter");
      expect(safe).toBe("john &lt;doe&gt;");
    });

    it("returns empty string for malicious payloads in query string", () => {
      const searchStr = "?filter=%3Cscript%3Ealert(1)%3C/script%3E";
      const safe = getSafeQueryParam(searchStr, "filter");
      expect(safe).toBe("");
    });
  });
});
