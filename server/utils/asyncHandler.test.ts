import { describe, expect, it, vi } from "vitest";
import { asyncHandler } from "./asyncHandler";

function mockReq(overrides = {}) {
  return { ...overrides };
}

function mockRes(overrides = {}) {
  return {
    jsonData: undefined,
    statusCode: 200,
    headers: {},
    json: vi.fn(function (data) {
      this.jsonData = data;
      return this;
    }),
    send: vi.fn(function (data) {
      this.jsonData = data;
      return this;
    }),
    status: vi.fn(function (code) {
      this.statusCode = code;
      return this;
    }),
    setHeader: vi.fn(function (name, value) {
      this.headers[name] = value;
      return this;
    }),
    ...overrides,
  };
}

function mockNext() {
  return vi.fn();
}

describe("asyncHandler", () => {
  it("calls res.json with the resolved value when handler succeeds", async () => {
    const req = mockReq({ body: { name: "Alice" } });
    const res = mockRes();
    const next = mockNext();

    const handler = asyncHandler(async (r, res) => {
      return res.json({ ok: true, name: r.body.name });
    });

    handler(req, res, next);

    await new Promise((r) => setTimeout(r, 10));

    expect(res.json).toHaveBeenCalledWith({ ok: true, name: "Alice" });
    expect(next).not.toHaveBeenCalled();
  });

  it("forwards rejected promise error to next", async () => {
    const req = mockReq();
    const res = mockRes();
    const next = mockNext();
    const boom = new Error("Database unavailable");

    const handler = asyncHandler(async () => {
      throw boom;
    });

    handler(req, res, next);

    await new Promise((r) => setTimeout(r, 10));

    expect(next).toHaveBeenCalledWith(boom);
    expect(res.json).not.toHaveBeenCalled();
  });

  it("forwards synchronous error thrown inside handler to next", async () => {
    const req = mockReq();
    const res = mockRes();
    const next = mockNext();

    const handler = asyncHandler(async () => {
      throw new Error("Sync error");
    });

    handler(req, res, next);

    await new Promise((r) => setTimeout(r, 10));

    expect(next).toHaveBeenCalled();
    const passedError = next.mock.calls[0][0];
    expect(passedError.message).toBe("Sync error");
  });

  it("does not call next on successful resolution", async () => {
    const req = mockReq();
    const res = mockRes();
    const next = mockNext();

    const handler = asyncHandler(async (_r, res) => {
      res.send("ok");
    });

    handler(req, res, next);

    await new Promise((r) => setTimeout(r, 10));

    expect(res.send).toHaveBeenCalledWith("ok");
    expect(next).not.toHaveBeenCalled();
  });
});
