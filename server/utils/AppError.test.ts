import { describe, it, expect } from "vitest";
import {
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
} from "./AppError";

describe("AppError", () => {
  it("stores message, statusCode, and isOperational", () => {
    const err = new AppError("something went wrong", 500, false);
    expect(err.message).toBe("something went wrong");
    expect(err.statusCode).toBe(500);
    expect(err.isOperational).toBe(false);
  });

  it("defaults isOperational to true", () => {
    const err = new AppError("generic", 500);
    expect(err.isOperational).toBe(true);
  });

  it("stores an optional errorCode", () => {
    const err = new AppError("rate limited", 429, true, "RATE_LIMIT");
    expect(err.errorCode).toBe("RATE_LIMIT");
  });

  it("captures a stack trace", () => {
    const err = new AppError("boom", 500);
    expect(err.stack).toBeDefined();
    expect(err.stack).toContain("AppError");
  });

  it("is an instance of Error", () => {
    const err = new AppError("test", 500);
    expect(err instanceof Error).toBe(true);
  });
});

describe("ValidationError", () => {
  it("has statusCode 400", () => {
    const err = new ValidationError("invalid input");
    expect(err.statusCode).toBe(400);
  });

  it("preserves the message", () => {
    const err = new ValidationError("field X is required");
    expect(err.message).toBe("field X is required");
  });

  it("defaults errorCode to undefined", () => {
    const err = new ValidationError("bad");
    expect(err.errorCode).toBeUndefined();
  });

  it("accepts an optional errorCode", () => {
    const err = new ValidationError("bad", "INVALID_FIELD");
    expect(err.errorCode).toBe("INVALID_FIELD");
  });

  it("is an instance of AppError", () => {
    const err = new ValidationError("bad");
    expect(err instanceof AppError).toBe(true);
  });

  it("is an instance of Error", () => {
    const err = new ValidationError("bad");
    expect(err instanceof Error).toBe(true);
  });
});

describe("UnauthorizedError", () => {
  it("has statusCode 401", () => {
    const err = new UnauthorizedError();
    expect(err.statusCode).toBe(401);
  });

  it("defaults to 'Unauthorized' message", () => {
    const err = new UnauthorizedError();
    expect(err.message).toBe("Unauthorized");
  });

  it("accepts a custom message", () => {
    const err = new UnauthorizedError("Token expired");
    expect(err.message).toBe("Token expired");
  });

  it("is an instance of AppError", () => {
    const err = new UnauthorizedError();
    expect(err instanceof AppError).toBe(true);
  });
});

describe("ForbiddenError", () => {
  it("has statusCode 403", () => {
    const err = new ForbiddenError();
    expect(err.statusCode).toBe(403);
  });

  it("defaults to 'Forbidden' message", () => {
    const err = new ForbiddenError();
    expect(err.message).toBe("Forbidden");
  });

  it("accepts a custom message", () => {
    const err = new ForbiddenError("Insufficient permissions");
    expect(err.message).toBe("Insufficient permissions");
  });

  it("is an instance of AppError", () => {
    const err = new ForbiddenError();
    expect(err instanceof AppError).toBe(true);
  });
});

describe("NotFoundError", () => {
  it("has statusCode 404", () => {
    const err = new NotFoundError();
    expect(err.statusCode).toBe(404);
  });

  it("defaults to 'Not found' message", () => {
    const err = new NotFoundError();
    expect(err.message).toBe("Not found");
  });

  it("accepts a custom message", () => {
    const err = new NotFoundError("Patient record not found");
    expect(err.message).toBe("Patient record not found");
  });

  it("is an instance of AppError", () => {
    const err = new NotFoundError();
    expect(err instanceof AppError).toBe(true);
  });
});

describe("ConflictError", () => {
  it("has statusCode 409", () => {
    const err = new ConflictError("resource already exists");
    expect(err.statusCode).toBe(409);
  });

  it("preserves the message", () => {
    const err = new ConflictError("duplicate entry");
    expect(err.message).toBe("duplicate entry");
  });

  it("is an instance of AppError", () => {
    const err = new ConflictError("conflict");
    expect(err instanceof AppError).toBe(true);
  });
});
