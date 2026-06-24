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
  it("sets message", () => {
    const err = new AppError("something went wrong", 500);
    expect(err.message).toBe("something went wrong");
  });

  it("sets statusCode", () => {
    expect(new AppError("bad", 400).statusCode).toBe(400);
    expect(new AppError("server error", 500).statusCode).toBe(500);
  });

  it("defaults isOperational to true", () => {
    expect(new AppError("test", 400).isOperational).toBe(true);
  });

  it("allows isOperational to be overridden", () => {
    expect(new AppError("programmer error", 500, false).isOperational).toBe(false);
  });

  it("sets optional errorCode", () => {
    const err = new AppError("validation failed", 400, true, "ERR_VALIDATION");
    expect(err.errorCode).toBe("ERR_VALIDATION");
  });

  it("omits errorCode when not provided", () => {
    const err = new AppError("oops", 500);
    expect(err.errorCode).toBeUndefined();
  });

  it("captures a stack trace", () => {
    const err = new AppError("oops", 500);
    expect(err.stack).toBeDefined();
    expect(err.stack).toContain("AppError");
  });

  it("is an instance of Error", () => {
    expect(new AppError("test", 400)).toBeInstanceOf(Error);
    expect(new AppError("test", 400)).toBeInstanceOf(AppError);
  });
});

describe("ValidationError", () => {
  it("defaults to status 400", () => {
    expect(new ValidationError("invalid input").statusCode).toBe(400);
  });

  it("sets message", () => {
    expect(new ValidationError("field x is required").message).toBe("field x is required");
  });

  it("sets isOperational true", () => {
    expect(new ValidationError("bad").isOperational).toBe(true);
  });

  it("sets optional errorCode", () => {
    expect(new ValidationError("bad", "INVALID_FIELD").errorCode).toBe("INVALID_FIELD");
  });

  it("omits errorCode when not provided", () => {
    expect(new ValidationError("bad").errorCode).toBeUndefined();
  });

  it("is an instance of AppError", () => {
    expect(new ValidationError("bad")).toBeInstanceOf(AppError);
  });
});

describe("UnauthorizedError", () => {
  it("defaults to status 401", () => {
    expect(new UnauthorizedError().statusCode).toBe(401);
  });

  it("defaults message to Unauthorized", () => {
    expect(new UnauthorizedError().message).toBe("Unauthorized");
  });

  it("accepts custom message", () => {
    expect(new UnauthorizedError("token expired").message).toBe("token expired");
  });

  it("is an instance of AppError", () => {
    expect(new UnauthorizedError()).toBeInstanceOf(AppError);
  });
});

describe("ForbiddenError", () => {
  it("defaults to status 403", () => {
    expect(new ForbiddenError().statusCode).toBe(403);
  });

  it("defaults message to Forbidden", () => {
    expect(new ForbiddenError().message).toBe("Forbidden");
  });

  it("accepts custom message", () => {
    expect(new ForbiddenError("insufficient permissions").message).toBe("insufficient permissions");
  });

  it("is an instance of AppError", () => {
    expect(new ForbiddenError()).toBeInstanceOf(AppError);
  });
});

describe("NotFoundError", () => {
  it("defaults to status 404", () => {
    expect(new NotFoundError().statusCode).toBe(404);
  });

  it("defaults message to Not found", () => {
    expect(new NotFoundError().message).toBe("Not found");
  });

  it("accepts custom message", () => {
    expect(new NotFoundError("patient record not found").message).toBe("patient record not found");
  });

  it("is an instance of AppError", () => {
    expect(new NotFoundError()).toBeInstanceOf(AppError);
  });
});

describe("ConflictError", () => {
  it("defaults to status 409", () => {
    expect(new ConflictError("duplicate entry").statusCode).toBe(409);
  });

  it("requires explicit message", () => {
    expect(new ConflictError("resource already exists").message).toBe("resource already exists");
  });

  it("is an instance of AppError", () => {
    expect(new ConflictError("conflict")).toBeInstanceOf(AppError);
  });
});
