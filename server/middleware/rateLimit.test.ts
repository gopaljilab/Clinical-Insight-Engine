import { describe, it, expect, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";

// Use vi.hoisted so capturedCalls is accessible in the hoisted vi.mock factory
const capturedCalls = vi.hoisted(() =>
  [] as Array<{ windowMs: number; limit: number; standardHeaders: boolean; legacyHeaders: boolean }>
);

vi.mock("express-rate-limit", () => ({
  rateLimit: vi.fn().mockImplementation((opts: any) => {
    capturedCalls.push({
      windowMs: opts.windowMs,
      limit: opts.limit,
      standardHeaders: opts.standardHeaders,
      legacyHeaders: opts.legacyHeaders,
    });
    return (req: Request, res: Response, next: NextFunction) => {
      next();
    };
  }),
}));

import {
  generalLimiter,
  mlLimiter,
  adminLimiter,
  exportLimiter,
  assessmentLimiter,
  previewLimiter,
} from "./rateLimit";

describe("rateLimit middleware exports", () => {
  it("generalLimiter is a function", () => {
    expect(typeof generalLimiter).toBe("function");
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

  describe("middleware calls next() for all limiters", () => {
    it("generalLimiter calls next()", () => {
      const mockNext = vi.fn();
      generalLimiter({ ip: "127.0.0.1" } as Request, {} as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it("mlLimiter calls next()", () => {
      const mockNext = vi.fn();
      mlLimiter({ ip: "127.0.0.1" } as Request, {} as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it("adminLimiter calls next()", () => {
      const mockNext = vi.fn();
      adminLimiter({ ip: "127.0.0.1" } as Request, {} as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it("exportLimiter calls next()", () => {
      const mockNext = vi.fn();
      exportLimiter({ ip: "127.0.0.1" } as Request, {} as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it("assessmentLimiter calls next()", () => {
      const mockNext = vi.fn();
      assessmentLimiter({ ip: "127.0.0.1" } as Request, {} as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it("previewLimiter calls next()", () => {
      const mockNext = vi.fn();
      previewLimiter({ ip: "127.0.0.1" } as Request, {} as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe("express-rate-limit configuration verification", () => {
    it("all 6 limiters were configured via rateLimit calls", () => {
      expect(capturedCalls.length).toBe(6);
    });

    it("generalLimiter was configured with windowMs=60000 and limit=100", () => {
      const generalCall = capturedCalls.find((c) => c.limit === 100);
      expect(generalCall?.windowMs).toBe(60000);
      expect(generalCall?.standardHeaders).toBe(true);
      expect(generalCall?.legacyHeaders).toBe(false);
    });

    it("mlLimiter was configured with windowMs=60000 and limit=20", () => {
      const mlCall = capturedCalls.find((c) => c.limit === 20);
      expect(mlCall?.windowMs).toBe(60000);
      expect(mlCall?.standardHeaders).toBe(true);
      expect(mlCall?.legacyHeaders).toBe(false);
    });

    it("adminLimiter was configured with windowMs=60000 and limit=60", () => {
      const adminCall = capturedCalls.find((c) => c.limit === 60);
      expect(adminCall?.windowMs).toBe(60000);
      expect(adminCall?.standardHeaders).toBe(true);
      expect(adminCall?.legacyHeaders).toBe(false);
    });

    it("exportLimiter was configured with windowMs=60000 and limit=10", () => {
      const exportCall = capturedCalls.find((c) => c.limit === 10 && c.windowMs === 60000);
      expect(exportCall?.windowMs).toBe(60000);
      expect(exportCall?.standardHeaders).toBe(true);
      expect(exportCall?.legacyHeaders).toBe(false);
    });

    it("assessmentLimiter was configured with windowMs=900000 and limit=5", () => {
      const assessCall = capturedCalls.find((c) => c.limit === 5);
      expect(assessCall?.windowMs).toBe(900000);
      expect(assessCall?.standardHeaders).toBe(true);
      expect(assessCall?.legacyHeaders).toBe(false);
    });

    it("previewLimiter was configured with windowMs=900000 and limit=10", () => {
      const previewCall = capturedCalls.find((c) => c.limit === 10 && c.windowMs === 900000);
      expect(previewCall?.windowMs).toBe(900000);
      expect(previewCall?.limit).toBe(10);
      expect(previewCall?.standardHeaders).toBe(true);
      expect(previewCall?.legacyHeaders).toBe(false);
    });
  });
});
