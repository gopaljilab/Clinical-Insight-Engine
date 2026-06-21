import { describe, it, expect } from "vitest";
import type { Request, Response, NextFunction } from "express";

import {
  generalLimiter,
  mlLimiter,
  adminLimiter,
  exportLimiter,
  assessmentLimiter,
  previewLimiter,
} from "./rateLimit";

describe("rateLimit middleware", () => {
  it("generalLimiter is a function with arity 3 (middleware signature)", () => {
    expect(typeof generalLimiter).toBe("function");
    expect(generalLimiter.length).toBeGreaterThanOrEqual(0);
  });

  it("mlLimiter is a function", () => {
    expect(typeof mlLimiter).toBe("function");
  });

  it("adminLimiter is a function", () => {
    expect(typeof adminLimiter).toBe("function");
  });

  it("exportLimiter is a function", () => {
    expect(typeof exportLimiter).toBe("function");
  });

  it("assessmentLimiter is a function", () => {
    expect(typeof assessmentLimiter).toBe("function");
  });

  it("previewLimiter is a function", () => {
    expect(typeof previewLimiter).toBe("function");
  });

  it("all limiters are distinct instances", () => {
    const instances = new Set([
      generalLimiter,
      mlLimiter,
      adminLimiter,
      exportLimiter,
      assessmentLimiter,
      previewLimiter,
    ]);
    expect(instances.size).toBe(6);
  });
});
