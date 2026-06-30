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

  it("defaults isOperational to true when not provided", () => {
    const err = new AppError("Oops", 418);
    expect(err.isOperational).toBe(true);
  });

  it("allows isOperational to be set to false", () => {
    const err = new AppError("Fatal", 500, false);
    expect(err.isOperational).toBe(false);
  });

  it("allows omitting errorCode", () => {
    const err = new AppError("Boom", 500);
    expect(err.errorCode).toBeUndefined();
  });

  it("is an instance of Error", () => {
    const err = new AppError("Test", 500);
    expect(err instanceof Error).toBe(true);
    expect(err instanceof AppError).toBe(true);
  });

  it("has a stack trace", () => {
    const err = new AppError("Test", 500);
    expect(err.stack).toBeDefined();
    expect(err.stack).toContain("AppError");
  });
});

describe("ValidationError", () => {
  it("sets statusCode to 400", () => {
    const err = new ValidationError("Invalid input");
    expect(err.statusCode).toBe(400);
  });

  it("defaults isOperational to true", () => {
    const err = new ValidationError("Invalid");
    expect(err.isOperational).toBe(true);
  });

  it("accepts an optional errorCode", () => {
    const err = new ValidationError("Invalid", "ERR_VALIDATION");
    expect(err.errorCode).toBe("ERR_VALIDATION");
  });

  it("is an instance of AppError", () => {
    const err = new ValidationError("x");
    expect(err instanceof AppError).toBe(true);
    expect(err instanceof ValidationError).toBe(true);
  });
});

describe("UnauthorizedError", () => {
  it("sets statusCode to 401", () => {
    const err = new UnauthorizedError();
    expect(err.statusCode).toBe(401);
  });

  it("defaults message to 'Unauthorized'", () => {
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
    expect(err instanceof UnauthorizedError).toBe(true);
  });
});

describe("ForbiddenError", () => {
  it("sets statusCode to 403", () => {
    const err = new ForbiddenError();
    expect(err.statusCode).toBe(403);
  });

  it("defaults message to 'Forbidden'", () => {
    const err = new ForbiddenError();
    expect(err.message).toBe("Forbidden");
  });

  it("is an instance of AppError", () => {
    const err = new ForbiddenError();
    expect(err instanceof AppError).toBe(true);
    expect(err instanceof ForbiddenError).toBe(true);
  });
});

describe("NotFoundError", () => {
  it("sets statusCode to 404", () => {
    const err = new NotFoundError();
    expect(err.statusCode).toBe(404);
  });

  it("defaults message to 'Not found'", () => {
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
    expect(err instanceof NotFoundError).toBe(true);
  });
});

describe("ConflictError", () => {
  it("sets statusCode to 409", () => {
    const err = new ConflictError("Duplicate entry");
    expect(err.statusCode).toBe(409);
  });

  it("is an instance of AppError", () => {
    const err = new ConflictError("x");
    expect(err instanceof AppError).toBe(true);
    expect(err instanceof ConflictError).toBe(true);
  });
});
