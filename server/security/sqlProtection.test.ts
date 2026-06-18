import { describe, expect, it } from "vitest";
import { sanitizeDatabaseError } from "./sqlProtection";

/**
 * Locks down the public mapping contract of `sanitizeDatabaseError`.
 *
 * The function maps internal PostgreSQL error codes to safe HTTP responses.
 * Any accidental swap of a code or status must be caught here.
 */
describe("sanitizeDatabaseError", () => {
  describe("PostgreSQL error code mapping", () => {
    it("maps 23505 (unique_violation) to 409 with a user-friendly message", () => {
      const result = sanitizeDatabaseError({ code: "23505", message: "duplicate key" });
      expect(result).toEqual({
        statusCode: 409,
        message: "A record with this information already exists.",
      });
    });

    it("maps 23503 (foreign_key_violation) to 400", () => {
      const result = sanitizeDatabaseError({ code: "23503", message: "fk violation" });
      expect(result).toEqual({
        statusCode: 400,
        message: "Invalid reference in the submitted data.",
      });
    });

    it("maps 23502 (not_null_violation) to 400", () => {
      const result = sanitizeDatabaseError({ code: "23502", message: "null value" });
      expect(result).toEqual({
        statusCode: 400,
        message: "A required field is missing.",
      });
    });

    it("maps 22P02 (invalid_text_representation) to 400", () => {
      const result = sanitizeDatabaseError({ code: "22P02", message: "invalid input syntax" });
      expect(result).toEqual({
        statusCode: 400,
        message: "Invalid data format.",
      });
    });

    it("maps 42P01 (undefined_table) to a generic 500", () => {
      const result = sanitizeDatabaseError({ code: "42P01", message: "relation does not exist" });
      expect(result).toEqual({
        statusCode: 500,
        message: "An unexpected error occurred.",
      });
    });

    it("maps 42703 (undefined_column) to a generic 500", () => {
      const result = sanitizeDatabaseError({ code: "42703", message: "column does not exist" });
      expect(result).toEqual({
        statusCode: 500,
        message: "An unexpected error occurred.",
      });
    });

    it("maps 42601 (syntax_error) to a generic 500", () => {
      const result = sanitizeDatabaseError({ code: "42601", message: "syntax error" });
      expect(result).toEqual({
        statusCode: 500,
        message: "An unexpected error occurred.",
      });
    });

    it("maps unrecognized PG codes to a generic 500", () => {
      const result = sanitizeDatabaseError({ code: "42XXX", message: "weird code" });
      expect(result).toEqual({
        statusCode: 500,
        message: "An unexpected error occurred.",
      });
    });
  });

  describe("non-PG error inputs", () => {
    it("returns generic 500 for a plain Error (no .code)", () => {
      const err = new Error("boom");
      const result = sanitizeDatabaseError(err);
      expect(result).toEqual({
        statusCode: 500,
        message: "An unexpected error occurred.",
      });
    });

    it("returns generic 500 for a plain object without .code", () => {
      const result = sanitizeDatabaseError({ message: "no code field" });
      expect(result).toEqual({
        statusCode: 500,
        message: "An unexpected error occurred.",
      });
    });

    it("returns generic 500 for null", () => {
      const result = sanitizeDatabaseError(null);
      expect(result).toEqual({
        statusCode: 500,
        message: "An unexpected error occurred.",
      });
    });

    it("returns generic 500 for undefined", () => {
      const result = sanitizeDatabaseError(undefined);
      expect(result).toEqual({
        statusCode: 500,
        message: "An unexpected error occurred.",
      });
    });

    it("returns generic 500 for a primitive (string)", () => {
      const result = sanitizeDatabaseError("something went wrong");
      expect(result).toEqual({
        statusCode: 500,
        message: "An unexpected error occurred.",
      });
    });

    it("returns generic 500 for a primitive (number)", () => {
      const result = sanitizeDatabaseError(42);
      expect(result).toEqual({
        statusCode: 500,
        message: "An unexpected error occurred.",
      });
    });
  });
});
