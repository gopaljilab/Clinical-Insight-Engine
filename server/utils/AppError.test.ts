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
  it("sets message and statusCode from constructor arguments", () => {
    const err = new AppError("Something went wrong", 500);
    expect(err.message).toBe("Something went wrong");
    expect(err.statusCode).toBe(500);
  });

  it("sets isOperational to true by default", () => {
    const err = new AppError("Oops", 400);
    expect(err.isOperational).toBe(true);
  });

  it("allows isOperational to be set to false", () => {
    const err = new AppError("Fatal error", 500, false);
    expect(err.isOperational).toBe(false);
  });

  it("accepts an optional errorCode", () => {
    const err = new AppError("Bad input", 400, true, "INVALID_INPUT");
    expect(err.errorCode).toBe("INVALID_INPUT");
  });

  it("has a stack trace", () => {
    const err = new AppError("Test", 400);
    expect(err.stack).toBeDefined();
    expect(err.stack.length).toBeGreaterThan(0);
  });

  it("is an instance of Error", () => {
    const err = new AppError("Test", 400);
    expect(err instanceof Error).toBe(true);
  });

  it("is an instance of AppError", () => {
    const err = new AppError("Test", 400);
    expect(err instanceof AppError).toBe(true);
  });
});

describe("ValidationError", () => {
  it("sets statusCode to 400", () => {
    const err = new ValidationError("Invalid field");
    expect(err.statusCode).toBe(400);
  });

  it("sets isOperational to true by default", () => {
    const err = new ValidationError("Invalid");
    expect(err.isOperational).toBe(true);
  });

  it("accepts optional errorCode", () => {
    const err = new ValidationError("Missing email", "MISSING_EMAIL");
    expect(err.errorCode).toBe("MISSING_EMAIL");
  });

  it("is an instance of AppError", () => {
    const err = new ValidationError("Test");
    expect(err instanceof AppError).toBe(true);
  });

  it("is an instance of ValidationError", () => {
    const err = new ValidationError("Test");
    expect(err instanceof ValidationError).toBe(true);
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

  it("uses custom message when provided", () => {
    const err = new UnauthorizedError("Token expired");
    expect(err.message).toBe("Token expired");
  });

  it("is an instance of AppError", () => {
    const err = new UnauthorizedError();
    expect(err instanceof AppError).toBe(true);
  });

  it("is an instance of UnauthorizedError", () => {
    const err = new UnauthorizedError();
    expect(err instanceof UnauthorizedError).toBe(true);
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

  it("uses custom message when provided", () => {
    const err = new ForbiddenError("Insufficient permissions");
    expect(err.message).toBe("Insufficient permissions");
  });

  it("is an instance of AppError", () => {
    const err = new ForbiddenError();
    expect(err instanceof AppError).toBe(true);
  });

  it("is an instance of ForbiddenError", () => {
    const err = new ForbiddenError();
    expect(err instanceof ForbiddenError).toBe(true);
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

  it("uses custom message when provided", () => {
    const err = new NotFoundError("Patient record not found");
    expect(err.message).toBe("Patient record not found");
  });

  it("is an instance of AppError", () => {
    const err = new NotFoundError();
    expect(err instanceof AppError).toBe(true);
  });

  it("is an instance of NotFoundError", () => {
    const err = new NotFoundError();
    expect(err instanceof NotFoundError).toBe(true);
  });
});

describe("ConflictError", () => {
  it("sets statusCode to 409", () => {
    const err = new ConflictError("Duplicate email");
    expect(err.statusCode).toBe(409);
  });

  it("sets the message from constructor argument", () => {
    const err = new ConflictError("Resource already exists");
    expect(err.message).toBe("Resource already exists");
  });

  it("accepts optional errorCode", () => {
    const err = new ConflictError("Duplicate", "DUPLICATE_ENTRY");
    expect(err.errorCode).toBe("DUPLICATE_ENTRY");
  });

  it("is an instance of AppError", () => {
    const err = new ConflictError("Test");
    expect(err instanceof AppError).toBe(true);
  });

  it("is an instance of ConflictError", () => {
    const err = new ConflictError("Test");
    expect(err instanceof ConflictError).toBe(true);
  });
});
