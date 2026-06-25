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
    const err = new AppError("Something went wrong", 500, true);
    expect(err.message).toBe("Something went wrong");
    expect(err.statusCode).toBe(500);
    expect(err.isOperational).toBe(true);
  });

  it("defaults isOperational to true", () => {
    const err = new AppError("Oops", 500);
    expect(err.isOperational).toBe(true);
  });

  it("stores an optional errorCode", () => {
    const err = new AppError("Bad input", 400, true, "ERR_BAD_INPUT");
    expect(err.errorCode).toBe("ERR_BAD_INPUT");
  });

  it("does not set errorCode when omitted", () => {
    const err = new AppError("Oops", 500);
    expect(err.errorCode).toBeUndefined();
  });

  it("has a stack trace", () => {
    const err = new AppError("Boom", 500);
    expect(err.stack).toBeDefined();
    expect(err.stack).toContain("AppError");
  });

  it("is an instance of Error", () => {
    const err = new AppError("Boom", 500);
    expect(err instanceof Error).toBe(true);
  });

  it("is an instance of AppError", () => {
    const err = new AppError("Boom", 500);
    expect(err instanceof AppError).toBe(true);
  });
});

describe("ValidationError", () => {
  it("sets statusCode to 400", () => {
    const err = new ValidationError("Invalid field");
    expect(err.statusCode).toBe(400);
  });

  it("sets isOperational to true", () => {
    const err = new ValidationError("Invalid field");
    expect(err.isOperational).toBe(true);
  });

  it("stores message", () => {
    const err = new ValidationError("Email is required");
    expect(err.message).toBe("Email is required");
  });

  it("accepts an optional errorCode", () => {
    const err = new ValidationError("Invalid", "ERR_VALIDATION");
    expect(err.errorCode).toBe("ERR_VALIDATION");
  });

  it("is an instance of AppError", () => {
    const err = new ValidationError("Invalid");
    expect(err instanceof AppError).toBe(true);
  });
});

describe("UnauthorizedError", () => {
  it("sets statusCode to 401", () => {
    const err = new UnauthorizedError();
    expect(err.statusCode).toBe(401);
  });

  it("uses default message when none provided", () => {
    const err = new UnauthorizedError();
    expect(err.message).toBe("Unauthorized");
  });

  it("accepts a custom message", () => {
    const err = new UnauthorizedError("Token expired");
    expect(err.message).toBe("Token expired");
  });

  it("accepts an optional errorCode", () => {
    const err = new UnauthorizedError("Invalid", "ERR_UNAUTHORIZED");
    expect(err.errorCode).toBe("ERR_UNAUTHORIZED");
  });

  it("is an instance of AppError", () => {
    const err = new UnauthorizedError();
    expect(err instanceof AppError).toBe(true);
  });
});

describe("ForbiddenError", () => {
  it("sets statusCode to 403", () => {
    const err = new ForbiddenError();
    expect(err.statusCode).toBe(403);
  });

  it("uses default message when none provided", () => {
    const err = new ForbiddenError();
    expect(err.message).toBe("Forbidden");
  });

  it("accepts a custom message", () => {
    const err = new ForbiddenError("Insufficient permissions");
    expect(err.message).toBe("Insufficient permissions");
  });

  it("accepts an optional errorCode", () => {
    const err = new ForbiddenError("Insufficient", "ERR_FORBIDDEN");
    expect(err.errorCode).toBe("ERR_FORBIDDEN");
  });

  it("is an instance of AppError", () => {
    const err = new ForbiddenError();
    expect(err instanceof AppError).toBe(true);
  });
});

describe("NotFoundError", () => {
  it("sets statusCode to 404", () => {
    const err = new NotFoundError();
    expect(err.statusCode).toBe(404);
  });

  it("uses default message when none provided", () => {
    const err = new NotFoundError();
    expect(err.message).toBe("Not found");
  });

  it("accepts a custom message", () => {
    const err = new NotFoundError("Patient not found");
    expect(err.message).toBe("Patient not found");
  });

  it("accepts an optional errorCode", () => {
    const err = new NotFoundError("Missing", "ERR_NOT_FOUND");
    expect(err.errorCode).toBe("ERR_NOT_FOUND");
  });

  it("is an instance of AppError", () => {
    const err = new NotFoundError();
    expect(err instanceof AppError).toBe(true);
  });
});

describe("ConflictError", () => {
  it("sets statusCode to 409", () => {
    const err = new ConflictError("Already exists");
    expect(err.statusCode).toBe(409);
  });

  it("stores message", () => {
    const err = new ConflictError("Email already in use");
    expect(err.message).toBe("Email already in use");
  });

  it("accepts an optional errorCode", () => {
    const err = new ConflictError("Conflict", "ERR_CONFLICT");
    expect(err.errorCode).toBe("ERR_CONFLICT");
  });

  it("is an instance of AppError", () => {
    const err = new ConflictError("Conflict");
    expect(err instanceof AppError).toBe(true);
  });
});
