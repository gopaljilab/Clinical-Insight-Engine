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
  it("stores message and statusCode", () => {
    const err = new AppError("Something went wrong", 500);
    expect(err.message).toBe("Something went wrong");
    expect(err.statusCode).toBe(500);
  });

  it("defaults isOperational to true", () => {
    const err = new AppError("Boom", 500);
    expect(err.isOperational).toBe(true);
  });

  it("accepts custom isOperational flag", () => {
    const err = new AppError("Boom", 500, false);
    expect(err.isOperational).toBe(false);
  });

  it("accepts optional errorCode", () => {
    const err = new AppError("Boom", 500, true, "ERR_INTERNAL");
    expect(err.errorCode).toBe("ERR_INTERNAL");
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
});

describe("ValidationError", () => {
  it("has status code 400", () => {
    const err = new ValidationError("Invalid input");
    expect(err.statusCode).toBe(400);
  });

  it("isOperational by default", () => {
    const err = new ValidationError("Invalid input");
    expect(err.isOperational).toBe(true);
  });

  it("accepts optional errorCode", () => {
    const err = new ValidationError("Invalid input", "ERR_VALIDATION_FAILED");
    expect(err.errorCode).toBe("ERR_VALIDATION_FAILED");
  });

  it("is an instance of AppError", () => {
    const err = new ValidationError("Invalid input");
    expect(err instanceof AppError).toBe(true);
  });
});

describe("UnauthorizedError", () => {
  it("has status code 401", () => {
    const err = new UnauthorizedError();
    expect(err.statusCode).toBe(401);
  });

  it("has default message", () => {
    const err = new UnauthorizedError();
    expect(err.message).toBe("Unauthorized");
  });

  it("accepts custom message", () => {
    const err = new UnauthorizedError("Token expired");
    expect(err.message).toBe("Token expired");
  });

  it("is an instance of AppError", () => {
    const err = new UnauthorizedError();
    expect(err instanceof AppError).toBe(true);
  });
});

describe("ForbiddenError", () => {
  it("has status code 403", () => {
    const err = new ForbiddenError();
    expect(err.statusCode).toBe(403);
  });

  it("has default message", () => {
    const err = new ForbiddenError();
    expect(err.message).toBe("Forbidden");
  });

  it("is an instance of AppError", () => {
    const err = new ForbiddenError();
    expect(err instanceof AppError).toBe(true);
  });
});

describe("NotFoundError", () => {
  it("has status code 404", () => {
    const err = new NotFoundError();
    expect(err.statusCode).toBe(404);
  });

  it("has default message", () => {
    const err = new NotFoundError();
    expect(err.message).toBe("Not found");
  });

  it("accepts custom message", () => {
    const err = new NotFoundError("Patient record not found");
    expect(err.message).toBe("Patient record not found");
  });

  it("is an instance of AppError", () => {
    const err = new NotFoundError();
    expect(err instanceof AppError).toBe(true);
  });
});

describe("ConflictError", () => {
  it("has status code 409", () => {
    const err = new ConflictError("Duplicate entry");
    expect(err.statusCode).toBe(409);
  });

  it("is an instance of AppError", () => {
    const err = new ConflictError("Duplicate entry");
    expect(err instanceof AppError).toBe(true);
  });
});
