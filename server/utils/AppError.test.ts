import { describe, it, expect } from "vitest";
import {
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
} from "./AppError";

describe("AppError (base)", () => {
  it("stores message and statusCode", () => {
    const err = new AppError("Something went wrong", 500);
    expect(err.message).toBe("Something went wrong");
    expect(err.statusCode).toBe(500);
  });

  it("defaults isOperational to true", () => {
    const err = new AppError("Oops", 400);
    expect(err.isOperational).toBe(true);
  });

  it("can set isOperational to false", () => {
    const err = new AppError("Fatal", 500, false);
    expect(err.isOperational).toBe(false);
  });

  it("stores optional errorCode", () => {
    const err = new AppError("Bad input", 400, true, "BAD_INPUT");
    expect(err.errorCode).toBe("BAD_INPUT");
  });

  it("errorCode is undefined when not provided", () => {
    const err = new AppError("Oops", 400);
    expect(err.errorCode).toBeUndefined();
  });

  it("is an instance of Error", () => {
    const err = new AppError("Test", 500);
    expect(err instanceof Error).toBe(true);
  });

  it("is an instance of AppError", () => {
    const err = new AppError("Test", 500);
    expect(err instanceof AppError).toBe(true);
  });

  it("has a stack trace", () => {
    const err = new AppError("Test", 500);
    expect(err.stack).toBeDefined();
    expect(err.stack!.length).toBeGreaterThan(0);
  });
});

describe("ValidationError", () => {
  it("statusCode is 400", () => {
    const err = new ValidationError("Invalid field");
    expect(err.statusCode).toBe(400);
  });

  it("isOperational is true", () => {
    const err = new ValidationError("Invalid field");
    expect(err.isOperational).toBe(true);
  });

  it("is an instance of AppError", () => {
    const err = new ValidationError("Invalid field");
    expect(err instanceof AppError).toBe(true);
  });

  it("accepts optional errorCode", () => {
    const err = new ValidationError("Missing email", "MISSING_EMAIL");
    expect(err.errorCode).toBe("MISSING_EMAIL");
  });

  it("errorCode is undefined without argument", () => {
    const err = new ValidationError("Invalid");
    expect(err.errorCode).toBeUndefined();
  });
});

describe("UnauthorizedError", () => {
  it("statusCode is 401", () => {
    const err = new UnauthorizedError();
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

  it("is an instance of AppError", () => {
    const err = new UnauthorizedError();
    expect(err instanceof AppError).toBe(true);
  });

  it("accepts optional errorCode", () => {
    const err = new UnauthorizedError("Expired", "TOKEN_EXPIRED");
    expect(err.errorCode).toBe("TOKEN_EXPIRED");
  });
});

describe("ForbiddenError", () => {
  it("statusCode is 403", () => {
    const err = new ForbiddenError();
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

  it("is an instance of AppError", () => {
    const err = new ForbiddenError();
    expect(err instanceof AppError).toBe(true);
  });
});

describe("NotFoundError", () => {
  it("statusCode is 404", () => {
    const err = new NotFoundError();
    expect(err.statusCode).toBe(404);
  });

  it("default message is 'Not found'", () => {
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
  it("statusCode is 409", () => {
    const err = new ConflictError("Duplicate entry");
    expect(err.statusCode).toBe(409);
  });

  it("accepts custom message", () => {
    const err = new ConflictError("Resource already exists");
    expect(err.message).toBe("Resource already exists");
  });

  it("isOperational is true", () => {
    const err = new ConflictError("Duplicate");
    expect(err.isOperational).toBe(true);
  });

  it("is an instance of AppError", () => {
    const err = new ConflictError("Conflict");
    expect(err instanceof AppError).toBe(true);
  });

  it("accepts optional errorCode", () => {
    const err = new ConflictError("Duplicate", "DUPLICATE_RESOURCE");
    expect(err.errorCode).toBe("DUPLICATE_RESOURCE");
  });
});

describe("Subclass hierarchy", () => {
  it("all subclasses are instanceof AppError", () => {
    expect(new ValidationError("v") instanceof AppError).toBe(true);
    expect(new UnauthorizedError() instanceof AppError).toBe(true);
    expect(new ForbiddenError() instanceof AppError).toBe(true);
    expect(new NotFoundError() instanceof AppError).toBe(true);
    expect(new ConflictError("c") instanceof AppError).toBe(true);
  });

  it("all subclasses are instanceof Error", () => {
    expect(new ValidationError("v") instanceof Error).toBe(true);
    expect(new UnauthorizedError() instanceof Error).toBe(true);
    expect(new ForbiddenError() instanceof Error).toBe(true);
    expect(new NotFoundError() instanceof Error).toBe(true);
    expect(new ConflictError("c") instanceof Error).toBe(true);
  });

  it("each subclass has the correct statusCode", () => {
    expect(new ValidationError("v").statusCode).toBe(400);
    expect(new UnauthorizedError().statusCode).toBe(401);
    expect(new ForbiddenError().statusCode).toBe(403);
    expect(new NotFoundError().statusCode).toBe(404);
    expect(new ConflictError("c").statusCode).toBe(409);
  });
});
