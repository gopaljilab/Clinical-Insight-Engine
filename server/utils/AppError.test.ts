import { describe, expect, it } from "vitest";
import {
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
} from "./AppError";

describe("AppError", () => {
  it("sets message, statusCode, isOperational, and errorCode", () => {
    const err = new AppError("Something went wrong", 500, true, "INTERNAL_ERROR");
    expect(err.message).toBe("Something went wrong");
    expect(err.statusCode).toBe(500);
    expect(err.isOperational).toBe(true);
    expect(err.errorCode).toBe("INTERNAL_ERROR");
  });

  it("defaults isOperational to true", () => {
    const err = new AppError("Oops", 500);
    expect(err.isOperational).toBe(true);
  });

  it("captures a stack trace", () => {
    const err = new AppError("Fail", 500);
    expect(err.stack).toBeDefined();
    expect(err.stack && err.stack.length).toBeGreaterThan(0);
  });

  it("is an instance of Error", () => {
    const err = new AppError("Fail", 500);
    expect(err instanceof Error).toBe(true);
    expect(err instanceof AppError).toBe(true);
  });
});

describe("ValidationError", () => {
  it("sets statusCode to 400", () => {
    const err = new ValidationError("Invalid input");
    expect(err.statusCode).toBe(400);
    expect(err.message).toBe("Invalid input");
  });

  it("carries an optional errorCode", () => {
    const err = new ValidationError("Bad field", "FIELD_REQUIRED");
    expect(err.errorCode).toBe("FIELD_REQUIRED");
  });

  it("is instanceof ValidationError and AppError and Error", () => {
    const err = new ValidationError("x");
    expect(err instanceof ValidationError).toBe(true);
    expect(err instanceof AppError).toBe(true);
    expect(err instanceof Error).toBe(true);
  });
});

describe("UnauthorizedError", () => {
  it("defaults message to 'Unauthorized' and statusCode to 401", () => {
    const err = new UnauthorizedError();
    expect(err.message).toBe("Unauthorized");
    expect(err.statusCode).toBe(401);
  });

  it("accepts a custom message", () => {
    const err = new UnauthorizedError("Token expired");
    expect(err.message).toBe("Token expired");
  });

  it("carries an optional errorCode", () => {
    const err = new UnauthorizedError("Expired", "AUTH_EXPIRED");
    expect(err.errorCode).toBe("AUTH_EXPIRED");
  });
});

describe("ForbiddenError", () => {
  it("defaults message to 'Forbidden' and statusCode to 403", () => {
    const err = new ForbiddenError();
    expect(err.message).toBe("Forbidden");
    expect(err.statusCode).toBe(403);
  });

  it("accepts a custom message", () => {
    const err = new ForbiddenError("Insufficient permissions");
    expect(err.message).toBe("Insufficient permissions");
  });
});

describe("NotFoundError", () => {
  it("defaults message to 'Not found' and statusCode to 404", () => {
    const err = new NotFoundError();
    expect(err.message).toBe("Not found");
    expect(err.statusCode).toBe(404);
  });

  it("accepts a custom message", () => {
    const err = new NotFoundError("Patient record not found");
    expect(err.message).toBe("Patient record not found");
  });
});

describe("ConflictError", () => {
  it("sets statusCode to 409", () => {
    const err = new ConflictError("Duplicate entry");
    expect(err.statusCode).toBe(409);
    expect(err.message).toBe("Duplicate entry");
  });
});
