import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { loggingAnomalyMiddleware } from "./loggingAnomaly";

// Track calls to mocked logger
const infoCalls: any[] = [];
const warnCalls: any[] = [];

vi.mock("../logger", () => ({
  logger: {
    info: (...args: any[]) => { infoCalls.push(args); },
    warn: (...args: any[]) => { warnCalls.push(args); },
    error: vi.fn(),
  },
}));

function mockResponse() {
  let finishHandler: () => void;
  const res = {
    statusCode: 200,
    ip: "127.0.0.1",
  } as unknown as Response;
  (res as any).on = function(event: string, handler: () => void) {
    if (event === "finish") {
      finishHandler = handler;
    }
    return this;
  };
  (res as any).triggerFinish = function() {
    if (finishHandler) finishHandler();
  };
  return res;
}

function mockRequest(overrides: Partial<Request> = {}): Request {
  return {
    method: "GET",
    path: "/api/assessments",
    ip: "127.0.0.1",
    ...overrides,
  } as unknown as Request;
}

describe("loggingAnomalyMiddleware", () => {
  beforeEach(() => {
    infoCalls.length = 0;
    warnCalls.length = 0;
  });

  it("calls next() immediately", () => {
    const req = mockRequest();
    const res = mockResponse();
    const next = vi.fn() as unknown as NextFunction;

    loggingAnomalyMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it("sets up res.on('finish') handler", () => {
    const req = mockRequest();
    const res = mockResponse();
    const next = vi.fn() as unknown as NextFunction;

    const onSpy = vi.spyOn(res, "on");

    loggingAnomalyMiddleware(req, res, next);

    expect(onSpy).toHaveBeenCalledWith("finish", expect.any(Function));
  });

  it("emits info log on response finish", () => {
    const req = mockRequest({ method: "POST", path: "/api/patients" });
    const res = mockResponse();
    const next = vi.fn() as unknown as NextFunction;

    loggingAnomalyMiddleware(req, res, next);
    (res as any).triggerFinish();

    expect(infoCalls.length).toBeGreaterThan(0);
    const logData = infoCalls[0][0];
    expect(logData.method).toBe("POST");
    expect(logData.path).toBe("/api/patients");
    expect(logData.status).toBeDefined();
    expect(logData.durationMs).toBeDefined();
  });

  it("emits warn log when duration exceeds 500ms", () => {
    vi.spyOn(Date, "now").mockReturnValueOnce(1000).mockReturnValueOnce(1600);
    const req = mockRequest();
    const res = mockResponse();
    const next = vi.fn() as unknown as NextFunction;

    loggingAnomalyMiddleware(req, res, next);
    (res as any).triggerFinish();

    expect(warnCalls.length).toBeGreaterThan(0);
    const warnData = warnCalls[0][0];
    expect(warnData.anomaly).toBe(true);
  });

  it("emits warn log when status code is 500 or above", () => {
    const req = mockRequest();
    const res = mockResponse();
    const next = vi.fn() as unknown as NextFunction;
    (res as any).statusCode = 500;

    loggingAnomalyMiddleware(req, res, next);
    (res as any).triggerFinish();

    expect(warnCalls.length).toBeGreaterThan(0);
    const warnData = warnCalls[0][0];
    expect(warnData.anomaly).toBe(true);
  });

  it("emits warn log when status code is 503 (server error)", () => {
    const req = mockRequest();
    const res = mockResponse();
    const next = vi.fn() as unknown as NextFunction;
    (res as any).statusCode = 503;

    loggingAnomalyMiddleware(req, res, next);
    (res as any).triggerFinish();

    expect(warnCalls.length).toBeGreaterThan(0);
  });

  it("does not emit warn log for normal response under 500ms with 200 status", () => {
    const req = mockRequest({ method: "GET", path: "/health" });
    const res = mockResponse();
    const next = vi.fn() as unknown as NextFunction;

    loggingAnomalyMiddleware(req, res, next);
    (res as any).triggerFinish();

    expect(infoCalls.length).toBeGreaterThan(0);
    expect(warnCalls.length).toBe(0);
  });

  it("does not emit warn log for 400 status (client error is not an anomaly)", () => {
    const req = mockRequest();
    const res = mockResponse();
    const next = vi.fn() as unknown as NextFunction;
    (res as any).statusCode = 400;

    loggingAnomalyMiddleware(req, res, next);
    (res as any).triggerFinish();

    expect(infoCalls.length).toBeGreaterThan(0);
    expect(warnCalls.length).toBe(0);
  });
});
