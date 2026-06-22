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
  it("constructs with message and statusCode", () => {
    const err = new AppError("Something went wrong", 500);
    expect(err.message).toBe("Something went wrong");
    expect(err.statusCode).toBe(500);
  });

  it("defaults isOperational to true", () => {
    const err = new AppError("Oops", 400);
    expect(err.isOperational).toBe(true);
  });

  it("accepts explicit isOperational value", () => {
    const err = new AppError("Crash", 500, false);
    expect(err.isOperational).toBe(false);
  });

  it("accepts optional errorCode", () => {
    const err = new AppError("Bad input", 400, true, "ERR_BAD_INPUT");
    expect(err.errorCode).toBe("ERR_BAD_INPUT");
  });

  it("errorCode defaults to undefined when not provided", () => {
    const err = new AppError("Oops", 500);
    expect(err.errorCode).toBeUndefined();
  });

  it("captures a stack trace", () => {
    const err = new AppError("Boom", 500);
    expect(err.stack).toBeDefined();
    expect(err.stack).toContain("AppError");
  });

  it("is an instance of Error", () => {
    const err = new AppError("Fail", 500);
    expect(err).toBeInstanceOf(Error);
  });

  it("is an instance of AppError", () => {
    const err = new AppError("Fail", 500);
    expect(err).toBeInstanceOf(AppError);
  });
});

describe("ValidationError", () => {
  it("extends AppError with statusCode 400", () => {
    const err = new ValidationError("Invalid field");
    expect(err).toBeInstanceOf(AppError);
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.statusCode).toBe(400);
  });

  it("isOperational is true by default", () => {
    const err = new ValidationError("Missing required field");
    expect(err.isOperational).toBe(true);
  });

  it("accepts optional errorCode", () => {
    const err = new ValidationError("Invalid email", "ERR_EMAIL");
    expect(err.errorCode).toBe("ERR_EMAIL");
  });
});

describe("UnauthorizedError", () => {
  it("extends AppError with statusCode 401", () => {
    const err = new UnauthorizedError();
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(401);
  });

  it("default message is 'Unauthorized'", () => {
    const err = new UnauthorizedError();
    expect(err.message).toBe("Unauthorized");
  });

  it("accepts custom message", () => {
    const err = new UnauthorizedError("Token expired");
    expect(err.message).toBe("Token expired");
  });

  it("accepts optional errorCode", () => {
    const err = new UnauthorizedError("Expired", "TOKEN_EXPIRED");
    expect(err.errorCode).toBe("TOKEN_EXPIRED");
  });
});

describe("ForbiddenError", () => {
  it("extends AppError with statusCode 403", () => {
    const err = new ForbiddenError();
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(403);
  });

  it("default message is 'Forbidden'", () => {
    const err = new ForbiddenError();
    expect(err.message).toBe("Forbidden");
  });

  it("accepts custom message", () => {
    const err = new ForbiddenError("Insufficient permissions");
    expect(err.message).toBe("Insufficient permissions");
  });
});

describe("NotFoundError", () => {
  it("extends AppError with statusCode 404", () => {
    const err = new NotFoundError();
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(404);
  });

  it("default message is 'Not found'", () => {
    const err = new NotFoundError();
    expect(err.message).toBe("Not found");
  });

  it("accepts custom message", () => {
    const err = new NotFoundError("Patient not found");
    expect(err.message).toBe("Patient not found");
  });
});

describe("ConflictError", () => {
  it("extends AppError with statusCode 409", () => {
    const err = new ConflictError("Duplicate entry");
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(409);
  });

  it("isOperational is true by default", () => {
    const err = new ConflictError("Already exists");
    expect(err.isOperational).toBe(true);
  });

  it("accepts optional errorCode", () => {
    const err = new ConflictError("Duplicate MRN", "ERR_DUP_MRN");
    expect(err.errorCode).toBe("ERR_DUP_MRN");
  });
});
