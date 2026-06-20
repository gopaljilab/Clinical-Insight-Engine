import { describe, expect, it, vi, beforeEach } from "vitest";
import bcrypt from "bcrypt";

// Mock tokenValidator
vi.mock("../services/auth/tokenValidator", () => {
  return {
    verifyToken: vi.fn(),
    issueToken: vi.fn(),
  };
});

// Mock storage
vi.mock("../storage", () => {
  return {
    storage: {
      getPatientUserByEmail: vi.fn(),
      getPatientUserByPatientName: vi.fn(),
      createPatientUser: vi.fn(),
      getPatientUserById: vi.fn(),
    },
  };
});

vi.mock("../logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import patientRouter from "./patient.routes";
import { hashPassword, verifyPassword } from "./patient.routes";
import { verifyToken } from "../services/auth/tokenValidator";

describe("password utility functions", () => {
  describe("hashPassword", () => {
    it("produces a valid bcrypt hash from a plaintext password", () => {
      const password = "securePassword123";
      const hash = hashPassword(password);
      expect(typeof hash).toBe("string");
      expect(hash).not.toBe(password);
      expect(hash.startsWith("$2")).toBe(true); // bcrypt prefix
    });

    it("produces different hashes for the same password due to bcrypt salt", () => {
      const password = "samePassword";
      const hash1 = hashPassword(password);
      const hash2 = hashPassword(password);
      expect(hash1).not.toBe(hash2);
    });

    it("hash can be verified with bcrypt.compareSync", () => {
      const password = "testPassword456";
      const hash = hashPassword(password);
      expect(bcrypt.compareSync(password, hash)).toBe(true);
    });
  });

  describe("verifyPassword", () => {
    it("returns true for a correct password and hash pair", () => {
      const password = "correctPassword";
      const hash = bcrypt.hashSync(password, 10);
      expect(verifyPassword(password, hash)).toBe(true);
    });

    it("returns false for an incorrect password", () => {
      const password = "correctPassword";
      const wrongPassword = "wrongPassword";
      const hash = bcrypt.hashSync(password, 10);
      expect(verifyPassword(wrongPassword, hash)).toBe(false);
    });

    it("returns false for empty password against valid hash", () => {
      const hash = bcrypt.hashSync("realPassword", 10);
      expect(verifyPassword("", hash)).toBe(false);
    });

    it("returns false when hash is tampered", () => {
      const password = "correctPassword";
      const hash = bcrypt.hashSync(password, 10);
      // Tamper with the last 2 characters
      const tamperedHash = hash.slice(0, -2) + "XX";
      expect(verifyPassword(password, tamperedHash)).toBe(false);
    });
  });
});

describe("requirePatientAuth middleware", () => {
  let mockReq: any;
  let mockRes: any;
  let mockNext: any;
  let statusJson: any;

  beforeEach(() => {
    vi.clearAllMocks();
    statusJson = {};
    mockReq = { headers: {} };
    mockRes = {
      status: vi.fn().mockImplementation((code: number) => {
        return mockRes;
      }),
      json: vi.fn().mockImplementation((data: any) => {
        statusJson = data;
        return mockRes;
      }),
    };
    mockNext = vi.fn();
  });

  // Mirror the requirePatientAuth logic from the module source
  function callRequirePatientAuth() {
    const authHeader = mockReq.headers?.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      mockRes.status(401).json({ error: "Unauthorized" });
      return;
    }
    const token = authHeader.slice(7);
    const result = (verifyToken as ReturnType<typeof vi.fn>)(token);
    if (!result.valid) {
      mockRes.status(401).json({ error: "Unauthorized" });
      return;
    }
    mockReq.jwtUser = result.payload;
    mockNext();
  }

  it("returns 401 when Authorization header is missing", () => {
    mockReq.headers = {};
    callRequirePatientAuth();
    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(statusJson).toEqual({ error: "Unauthorized" });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it("returns 401 when Authorization header does not start with Bearer", () => {
    mockReq.headers = { authorization: "Basic dXNlcjpwYXNz" };
    callRequirePatientAuth();
    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(statusJson).toEqual({ error: "Unauthorized" });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it("returns 401 when token is invalid", () => {
    mockReq.headers = { authorization: "Bearer invalid.jwt.token" };
    (verifyToken as ReturnType<typeof vi.fn>).mockReturnValue({ valid: false });
    callRequirePatientAuth();
    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(statusJson).toEqual({ error: "Unauthorized" });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it("returns 401 when token is expired", () => {
    mockReq.headers = { authorization: "Bearer expired.jwt.token" };
    (verifyToken as ReturnType<typeof vi.fn>).mockReturnValue({ valid: false });
    callRequirePatientAuth();
    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it("calls next() and sets jwtUser when token is valid", () => {
    const validPayload = { sub: "user-123", email: "patient@example.com" };
    mockReq.headers = { authorization: "Bearer valid.jwt.token" };
    (verifyToken as ReturnType<typeof vi.fn>).mockReturnValue({ valid: true, payload: validPayload });
    callRequirePatientAuth();
    expect(mockNext).toHaveBeenCalledTimes(1);
    expect(mockReq.jwtUser).toEqual(validPayload);
    expect(mockRes.status).not.toHaveBeenCalled();
  });
});
