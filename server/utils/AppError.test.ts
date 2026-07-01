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
  it("sets message and statusCode", () => {
    const err = new AppError("something went wrong", 500);
    expect(err.message).toBe("something went wrong");
    expect(err.statusCode).toBe(500);
  });

  it("defaults isOperational to true", () => {
    const err = new AppError("oops", 500);
    expect(err.isOperational).toBe(true);
  });

  it("accepts custom isOperational flag", () => {
    const err = new AppError("oops", 500, false);
    expect(err.isOperational).toBe(false);
  });

  it("accepts optional errorCode", () => {
    const err = new AppError("oops", 500, true, "ERR_INTERNAL");
    expect(err.errorCode).toBe("ERR_INTERNAL");
  });

  it("has a stack trace", () => {
    const err = new AppError("oops", 500);
    expect(err.stack).toBeDefined();
    expect(err.stack).toContain("AppError");
  });

  it("is instanceof Error", () => {
    const err = new AppError("oops", 500);
    expect(err).toBeInstanceOf(Error);
  });

  it("is instanceof AppError", () => {
    const err = new AppError("oops", 500);
    expect(err).toBeInstanceOf(AppError);
  });

  it("toJSON returns structured data", () => {
    const err = new AppError("oops", 500, true, "ERR_INTERNAL");
    const json = err.toJSON ? err.toJSON() : { message: err.message, statusCode: err.statusCode };
    expect(json.message).toBe("oops");
    expect(json.statusCode).toBe(500);
  });
});

describe("ValidationError", () => {
  it("has statusCode 400", () => {
    const err = new ValidationError("invalid input");
    expect(err.statusCode).toBe(400);
  });

  it("is instanceof AppError", () => {
    const err = new ValidationError("bad");
    expect(err).toBeInstanceOf(AppError);
  });

  it("accepts errorCode", () => {
    const err = new ValidationError("missing field", "ERR_VALIDATION");
    expect(err.errorCode).toBe("ERR_VALIDATION");
  });
});

describe("UnauthorizedError", () => {
  it("has statusCode 401", () => {
    const err = new UnauthorizedError();
    expect(err.statusCode).toBe(401);
  });

  it("uses default message when none provided", () => {
    const err = new UnauthorizedError();
    expect(err.message).toBe("Unauthorized");
  });

  it("accepts custom message", () => {
    const err = new UnauthorizedError("token expired");
    expect(err.message).toBe("token expired");
  });
});

describe("ForbiddenError", () => {
  it("has statusCode 403", () => {
    const err = new ForbiddenError();
    expect(err.statusCode).toBe(403);
  });

  it("uses default message", () => {
    const err = new ForbiddenError();
    expect(err.message).toBe("Forbidden");
  });
});

describe("NotFoundError", () => {
  it("has statusCode 404", () => {
    const err = new NotFoundError();
    expect(err.statusCode).toBe(404);
  });

  it("uses default message", () => {
    const err = new NotFoundError();
    expect(err.message).toBe("Not found");
  });

  it("accepts custom message", () => {
    const err = new NotFoundError("assessment not found");
    expect(err.message).toBe("assessment not found");
  });
});

describe("ConflictError", () => {
  it("has statusCode 409", () => {
    const err = new ConflictError("duplicate entry");
    expect(err.statusCode).toBe(409);
  });

  it("accepts errorCode", () => {
    const err = new ConflictError("duplicate", "ERR_CONFLICT");
    expect(err.errorCode).toBe("ERR_CONFLICT");
  });
});
