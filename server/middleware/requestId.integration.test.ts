import { describe, it, expect } from "vitest";
import type { Request, Response } from "express";
import { requestIdMiddleware } from "./requestId";
import { requestContext } from "../logger";

// Integration test: uses the REAL requestContext (AsyncLocalStorage), unmocked,
// to verify the request ID is genuinely retrievable from within the async
// context established by the middleware, not just passed to a mocked run().

function mockRequest(headers: Record<string, string> = {}): Request {
  return { headers } as unknown as Request;
}

function mockResponse() {
  return { setHeader: () => {} } as unknown as Response;
}

describe("requestIdMiddleware - AsyncLocalStorage integration", () => {
  it("makes the request id retrievable via requestContext.getStore() inside next()", () => {
    const req = mockRequest({ "x-request-id": "integration-trace-id" });
    const res = mockResponse();

    let storeValueInsideNext: string | undefined;

    requestIdMiddleware(req, res, () => {
      storeValueInsideNext = requestContext.getStore();
    });

    expect(storeValueInsideNext).toBe("integration-trace-id");
  });

  it("makes a generated UUID retrievable via requestContext.getStore() when no header is provided", () => {
    const req = mockRequest();
    const res = mockResponse();

    let storeValueInsideNext: string | undefined;

    requestIdMiddleware(req, res, () => {
      storeValueInsideNext = requestContext.getStore();
    });

    expect(storeValueInsideNext).toBe((req as any).id);
    expect(storeValueInsideNext).toBeTruthy();
  });

  it("does not leak context between two sequential requests", () => {
    const req1 = mockRequest({ "x-request-id": "request-one" });
    const req2 = mockRequest({ "x-request-id": "request-two" });
    const res = mockResponse();

    let firstStore: string | undefined;
    let secondStore: string | undefined;

    requestIdMiddleware(req1, res, () => {
      firstStore = requestContext.getStore();
    });

    requestIdMiddleware(req2, res, () => {
      secondStore = requestContext.getStore();
    });

    expect(firstStore).toBe("request-one");
    expect(secondStore).toBe("request-two");
    expect(requestContext.getStore()).toBeUndefined();
  });
});