import { expect, test, describe } from "vitest";
import {
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
} from "./AppError";

describe("AppError", () => {
  test("sets message, statusCode, and isOperational", () => {
    const err = new AppError("Something went wrong", 500);
    expect(err.message).toBe("Something went wrong");
    expect(err.statusCode).toBe(500);
    expect(err.isOperational).toBe(true);
  });

  test("sets isOperational to false when passed false", () => {
    const err = new AppError("Fatal error", 500, false);
    expect(err.isOperational).toBe(false);
  });

  test("sets optional errorCode", () => {
    const err = new AppError("Not found", 404, true, "RESOURCE_NOT_FOUND");
    expect(err.errorCode).toBe("RESOURCE_NOT_FOUND");
  });

  test("omitting errorCode leaves it undefined", () => {
    const err = new AppError("Bad request", 400);
    expect(err.errorCode).toBeUndefined();
  });

  test("is an instance of Error", () => {
    const err = new AppError("Test", 418);
    expect(err instanceof Error).toBe(true);
    expect(err instanceof AppError).toBe(true);
  });

  test("has a stack trace", () => {
    const err = new AppError("Test", 500);
    expect(typeof err.stack).toBe("string");
    expect(err.stack && err.stack.length > 0).toBe(true);
  });
});

describe("ValidationError", () => {
  test("sets statusCode to 400", () => {
    const err = new ValidationError("Invalid input");
    expect(err.statusCode).toBe(400);
  });

  test("defaults to operational", () => {
    const err = new ValidationError("Missing field");
    expect(err.isOperational).toBe(true);
  });

  test("accepts optional errorCode", () => {
    const err = new ValidationError("Bad field", "FIELD_REQUIRED");
    expect(err.errorCode).toBe("FIELD_REQUIRED");
    expect(err.message).toBe("Bad field");
  });

  test("is an instance of AppError", () => {
    const err = new ValidationError("Test");
    expect(err instanceof AppError).toBe(true);
  });
});

describe("UnauthorizedError", () => {
  test("sets statusCode to 401", () => {
    const err = new UnauthorizedError();
    expect(err.statusCode).toBe(401);
  });

  test("uses default message when not provided", () => {
    const err = new UnauthorizedError();
    expect(err.message).toBe("Unauthorized");
  });

  test("accepts custom message", () => {
    const err = new UnauthorizedError("Token expired");
    expect(err.message).toBe("Token expired");
  });

  test("is an instance of AppError", () => {
    const err = new UnauthorizedError();
    expect(err instanceof AppError).toBe(true);
  });
});

describe("ForbiddenError", () => {
  test("sets statusCode to 403", () => {
    const err = new ForbiddenError();
    expect(err.statusCode).toBe(403);
  });

  test("uses default message when not provided", () => {
    const err = new ForbiddenError();
    expect(err.message).toBe("Forbidden");
  });

  test("accepts custom message", () => {
    const err = new ForbiddenError("Insufficient permissions");
    expect(err.message).toBe("Insufficient permissions");
  });

  test("is an instance of AppError", () => {
    const err = new ForbiddenError();
    expect(err instanceof AppError).toBe(true);
  });
});

describe("NotFoundError", () => {
  test("sets statusCode to 404", () => {
    const err = new NotFoundError();
    expect(err.statusCode).toBe(404);
  });

  test("uses default message when not provided", () => {
    const err = new NotFoundError();
    expect(err.message).toBe("Not found");
  });

  test("accepts custom message", () => {
    const err = new NotFoundError("Patient record not found");
    expect(err.message).toBe("Patient record not found");
  });

  test("is an instance of AppError", () => {
    const err = new NotFoundError();
    expect(err instanceof AppError).toBe(true);
  });
});

describe("ConflictError", () => {
  test("sets statusCode to 409", () => {
    const err = new ConflictError("Duplicate entry");
    expect(err.statusCode).toBe(409);
  });

  test("accepts optional errorCode", () => {
    const err = new ConflictError("Email already exists", "DUPLICATE_EMAIL");
    expect(err.errorCode).toBe("DUPLICATE_EMAIL");
  });

  test("is an instance of AppError", () => {
    const err = new ConflictError("Test");
    expect(err instanceof AppError).toBe(true);
  });
});
