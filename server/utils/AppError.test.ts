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
  it("sets statusCode from constructor", () => {
    const err = new AppError("test", 500);
    expect(err.statusCode).toBe(500);
  });

  it("sets isOperational to true by default", () => {
    const err = new AppError("test", 400);
    expect(err.isOperational).toBe(true);
  });

  it("sets isOperational to false when explicitly passed", () => {
    const err = new AppError("test", 500, false);
    expect(err.isOperational).toBe(false);
  });

  it("sets errorCode when provided", () => {
    const err = new AppError("test", 400, true, "VALIDATION_FAILED");
    expect(err.errorCode).toBe("VALIDATION_FAILED");
  });

  it("sets errorCode to undefined when not provided", () => {
    const err = new AppError("test", 400);
    expect(err.errorCode).toBeUndefined();
  });

  it("has a message from constructor", () => {
    const err = new AppError("Something went wrong", 500);
    expect(err.message).toBe("Something went wrong");
  });

  it("is an instance of Error", () => {
    const err = new AppError("test", 500);
    expect(err instanceof Error).toBe(true);
  });

  it("is an instance of AppError", () => {
    const err = new AppError("test", 500);
    expect(err instanceof AppError).toBe(true);
  });

  it("has a stack trace", () => {
    const err = new AppError("test", 500);
    expect(err.stack).toBeDefined();
    expect(err.stack && err.stack.length > 0).toBe(true);
  });
});

describe("ValidationError", () => {
  it("has statusCode 400", () => {
    const err = new ValidationError("Invalid input");
    expect(err.statusCode).toBe(400);
  });

  it("is an instance of AppError", () => {
    const err = new ValidationError("Invalid input");
    expect(err instanceof AppError).toBe(true);
  });

  it("has the provided message", () => {
    const err = new ValidationError("Field is required");
    expect(err.message).toBe("Field is required");
  });

  it("passes errorCode through when provided", () => {
    const err = new ValidationError("Invalid input", "ERR_001");
    expect(err.errorCode).toBe("ERR_001");
  });

  it("is operational by default", () => {
    const err = new ValidationError("Invalid input");
    expect(err.isOperational).toBe(true);
  });
});

describe("UnauthorizedError", () => {
  it("has statusCode 401", () => {
    const err = new UnauthorizedError();
    expect(err.statusCode).toBe(401);
  });

  it("has default message 'Unauthorized'", () => {
    const err = new UnauthorizedError();
    expect(err.message).toBe("Unauthorized");
  });

  it("uses custom message when provided", () => {
    const err = new UnauthorizedError("Token has expired");
    expect(err.message).toBe("Token has expired");
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

  it("has default message 'Forbidden'", () => {
    const err = new ForbiddenError();
    expect(err.message).toBe("Forbidden");
  });

  it("uses custom message when provided", () => {
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

  it("has default message 'Not found'", () => {
    const err = new NotFoundError();
    expect(err.message).toBe("Not found");
  });

  it("uses custom message when provided", () => {
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
    const err = new ConflictError("Duplicate entry");
    expect(err.statusCode).toBe(409);
  });

  it("uses the provided message", () => {
    const err = new ConflictError("Email already registered");
    expect(err.message).toBe("Email already registered");
  });

  it("is an instance of AppError", () => {
    const err = new ConflictError("Conflict");
    expect(err instanceof AppError).toBe(true);
  });
});
