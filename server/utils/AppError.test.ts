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
  it("sets statusCode and isOperational", () => {
    const err = new AppError("test", 500, true, "TEST_CODE");
    expect(err.statusCode).toBe(500);
    expect(err.isOperational).toBe(true);
    expect(err.errorCode).toBe("TEST_CODE");
    expect(err.message).toBe("test");
    expect(err instanceof Error).toBe(true);
  });

  it("has a stack trace", () => {
    const err = new AppError("with stack", 500);
    expect(typeof err.stack).toBe("string");
    expect(err.stack!.length).toBeGreaterThan(0);
  });

  it("defaults isOperational to true", () => {
    const err = new AppError("default", 500);
    expect(err.isOperational).toBe(true);
  });
});

describe("ValidationError", () => {
  it("sets statusCode to 400", () => {
    const err = new ValidationError("Invalid input");
    expect(err.statusCode).toBe(400);
    expect(err.message).toBe("Invalid input");
    expect(err.isOperational).toBe(true);
  });

  it("supports optional errorCode", () => {
    const err = new ValidationError("Invalid", "ERR_VALIDATION");
    expect(err.errorCode).toBe("ERR_VALIDATION");
  });
});

describe("UnauthorizedError", () => {
  it("sets statusCode to 401", () => {
    const err = new UnauthorizedError();
    expect(err.statusCode).toBe(401);
    expect(err.message).toBe("Unauthorized");
  });

  it("accepts custom message", () => {
    const err = new UnauthorizedError("Token expired", "TOKEN_EXPIRED");
    expect(err.message).toBe("Token expired");
    expect(err.errorCode).toBe("TOKEN_EXPIRED");
  });
});

describe("ForbiddenError", () => {
  it("sets statusCode to 403", () => {
    const err = new ForbiddenError();
    expect(err.statusCode).toBe(403);
    expect(err.message).toBe("Forbidden");
  });

  it("accepts custom message", () => {
    const err = new ForbiddenError("Insufficient permissions");
    expect(err.message).toBe("Insufficient permissions");
  });
});

describe("NotFoundError", () => {
  it("sets statusCode to 404", () => {
    const err = new NotFoundError();
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe("Not found");
  });

  it("accepts custom message", () => {
    const err = new NotFoundError("Patient not found");
    expect(err.message).toBe("Patient not found");
  });
});

describe("ConflictError", () => {
  it("sets statusCode to 409", () => {
    const err = new ConflictError("Duplicate entry");
    expect(err.statusCode).toBe(409);
    expect(err.message).toBe("Duplicate entry");
  });
});

describe("instanceof chain", () => {
  it("ValidationError is instance of AppError", () => {
    const err = new ValidationError("bad");
    expect(err instanceof AppError).toBe(true);
    expect(err instanceof ValidationError).toBe(true);
  });

  it("UnauthorizedError is instance of AppError", () => {
    const err = new UnauthorizedError();
    expect(err instanceof AppError).toBe(true);
    expect(err instanceof UnauthorizedError).toBe(true);
  });

  it("ForbiddenError is instance of AppError", () => {
    const err = new ForbiddenError();
    expect(err instanceof AppError).toBe(true);
    expect(err instanceof ForbiddenError).toBe(true);
  });

  it("NotFoundError is instance of AppError", () => {
    const err = new NotFoundError();
    expect(err instanceof AppError).toBe(true);
    expect(err instanceof NotFoundError).toBe(true);
  });

  it("ConflictError is instance of AppError", () => {
    const err = new ConflictError("conflict");
    expect(err instanceof AppError).toBe(true);
    expect(err instanceof ConflictError).toBe(true);
  });
});
