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
  it("sets statusCode and isOperational from constructor arguments", () => {
    const err = new AppError("Something went wrong", 500);
    expect(err.statusCode).toBe(500);
    expect(err.isOperational).toBe(true);
  });

  it("sets isOperational=false when passed as constructor argument", () => {
    const err = new AppError("Critical failure", 500, false);
    expect(err.isOperational).toBe(false);
  });

  it("sets errorCode when provided in constructor", () => {
    const err = new AppError("Bad input", 400, true, "INVALID_INPUT");
    expect(err.errorCode).toBe("INVALID_INPUT");
  });

  it("errorCode is undefined when not provided", () => {
    const err = new AppError("Error", 500);
    expect(err.errorCode).toBeUndefined();
  });

  it("has a message property from Error base class", () => {
    const err = new AppError("Custom error message", 400);
    expect(err.message).toBe("Custom error message");
  });

  it("captures a stack trace", () => {
    const err = new AppError("Error with stack", 500);
    expect(err.stack).toBeDefined();
    expect(err.stack).toContain("AppError");
  });

  it("prototype chain is correct via Object.getPrototypeOf", () => {
    const err = new AppError("test", 500);
    expect(Object.getPrototypeOf(err).constructor).toBe(AppError);
  });

  it("is an instance of Error", () => {
    const err = new AppError("test", 500);
    expect(err instanceof Error).toBe(true);
  });

  it("is an instance of AppError", () => {
    const err = new AppError("test", 500);
    expect(err instanceof AppError).toBe(true);
  });
});

describe("ValidationError", () => {
  it("has statusCode 400", () => {
    const err = new ValidationError("Invalid field");
    expect(err.statusCode).toBe(400);
  });

  it("is operational by default", () => {
    const err = new ValidationError("Bad data");
    expect(err.isOperational).toBe(true);
  });

  it("accepts optional errorCode", () => {
    const err = new ValidationError("Missing field", "FIELD_REQUIRED");
    expect(err.errorCode).toBe("FIELD_REQUIRED");
  });

  it("is an instance of AppError", () => {
    const err = new ValidationError("test");
    expect(err instanceof AppError).toBe(true);
  });

  it("is an instance of ValidationError", () => {
    const err = new ValidationError("test");
    expect(err instanceof ValidationError).toBe(true);
  });
});

describe("UnauthorizedError", () => {
  it("has statusCode 401", () => {
    const err = new UnauthorizedError();
    expect(err.statusCode).toBe(401);
  });

  it("uses default message 'Unauthorized'", () => {
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
  it("has statusCode 403", () => {
    const err = new ForbiddenError();
    expect(err.statusCode).toBe(403);
  });

  it("uses default message 'Forbidden'", () => {
    const err = new ForbiddenError();
    expect(err.message).toBe("Forbidden");
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

  it("uses default message 'Not found'", () => {
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
  it("has statusCode 409", () => {
    const err = new ConflictError("Duplicate entry");
    expect(err.statusCode).toBe(409);
  });

  it("is an instance of AppError", () => {
    const err = new ConflictError("test");
    expect(err instanceof AppError).toBe(true);
  });
});

describe("AppError subclass hierarchy", () => {
  it("all subclasses are instanceof Error", () => {
    expect(new ValidationError("v") instanceof Error).toBe(true);
    expect(new UnauthorizedError() instanceof Error).toBe(true);
    expect(new ForbiddenError() instanceof Error).toBe(true);
    expect(new NotFoundError() instanceof Error).toBe(true);
    expect(new ConflictError("c") instanceof Error).toBe(true);
  });

  it("subclasses have correct prototype chain", () => {
    expect(Object.getPrototypeOf(new ValidationError("v")).constructor).toBe(ValidationError);
    expect(Object.getPrototypeOf(new UnauthorizedError()).constructor).toBe(UnauthorizedError);
    expect(Object.getPrototypeOf(new ForbiddenError()).constructor).toBe(ForbiddenError);
    expect(Object.getPrototypeOf(new NotFoundError()).constructor).toBe(NotFoundError);
    expect(Object.getPrototypeOf(new ConflictError("c")).constructor).toBe(ConflictError);
  });
});
