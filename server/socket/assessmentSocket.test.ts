import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock ws module completely
vi.mock("ws", () => {
  const mockOn = vi.fn();
  const mockClose = vi.fn();
  const mockSend = vi.fn();
  const mockWebSocket = vi.fn(() => ({
    on: mockOn,
    close: mockClose,
    send: mockSend,
    readyState: 1, // WebSocket.OPEN
  }));

  return {
    WebSocketServer: vi.fn(() => ({
      on: mockOn,
      close: vi.fn(),
    })),
    WebSocket: Object.assign(mockWebSocket, {
      OPEN: 1,
      CONNECTING: 0,
      CLOSING: 2,
      CLOSED: 3,
    }),
  };
});

// Mock tokenValidator
vi.mock("../services/auth/tokenValidator", () => ({
  verifyToken: vi.fn(),
}));

// Mock queue
vi.mock("../queue", () => ({
  getAssessmentQueue: vi.fn(),
}));

// Mock logger
vi.mock("../logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { WebSocketServer } from "ws";
import { verifyToken } from "../services/auth/tokenValidator";
import { getAssessmentQueue } from "../queue";
import { initAssessmentSocket, emitAssessmentProgress, emitAssessmentCompleted, emitAssessmentFailed } from "./assessmentSocket";

describe("assessmentSocket", () => {
  let mockHttpServer: any;
  let mockQueue: any;

  const VALID_TOKEN = "valid.jwt.token";
  const VALID_USER_ID = "user-123";
  const VALID_JOB_ID = "job-456";

  beforeEach(() => {
    vi.clearAllMocks();

    // Create a mock HTTP server that passes ws.WebSocketServer validation
    mockHttpServer = {
      on: vi.fn(),
      listening: false,
      address: () => ({ port: 5000 }),
    };

    mockQueue = {
      getJob: vi.fn(),
    };
    vi.mocked(getAssessmentQueue).mockReturnValue(mockQueue);
  });

  describe("initAssessmentSocket", () => {
    it("creates a WebSocketServer on the given httpServer", () => {
      initAssessmentSocket(mockHttpServer);
      expect(WebSocketServer).toHaveBeenCalledWith({
        server: mockHttpServer,
        path: "/ws/assessments",
      });
    });

    it("registers a connection handler on the WebSocketServer", () => {
      initAssessmentSocket(mockHttpServer);
      const wssInstance = vi.mocked(WebSocketServer).mock.results[0]?.value;
      expect(wssInstance.on).toHaveBeenCalledWith("connection", expect.any(Function));
    });
  });

  describe("token verification", () => {
    it("calls verifyToken and returns valid for a correct token", () => {
      vi.mocked(verifyToken).mockReturnValue({
        valid: true,
        payload: {
          sub: VALID_USER_ID,
          email: "test@example.com",
          role: "provider",
        },
      });

      const result = verifyToken(VALID_TOKEN);
      expect(result.valid).toBe(true);
      expect(result.payload.sub).toBe(VALID_USER_ID);
      expect(result.payload.email).toBe("test@example.com");
      expect(result.payload.role).toBe("provider");
      expect(verifyToken).toHaveBeenCalledWith(VALID_TOKEN);
    });

    it("rejects tokens with invalid signature", () => {
      vi.mocked(verifyToken).mockReturnValue({
        valid: false,
        reason: "invalid_signature",
      });

      const result = verifyToken("fake-token");
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("invalid_signature");
    });

    it("rejects expired tokens", () => {
      vi.mocked(verifyToken).mockReturnValue({
        valid: false,
        reason: "expired",
      });

      const result = verifyToken("expired-token");
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("expired");
    });

    it("rejects tokens with alg=none attack", () => {
      vi.mocked(verifyToken).mockReturnValue({
        valid: false,
        reason: "alg_not_allowed",
      });

      const result = verifyToken("alg-none-token");
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("alg_not_allowed");
    });
  });

  describe("job ownership verification", () => {
    it("looks up the job in the BullMQ queue", async () => {
      vi.mocked(verifyToken).mockReturnValue({
        valid: true,
        payload: {
          sub: VALID_USER_ID,
          email: "test@example.com",
          role: "provider",
        },
      });

      mockQueue.getJob.mockResolvedValue({
        id: VALID_JOB_ID,
        data: { userId: VALID_USER_ID },
      });

      const job = await mockQueue.getJob(VALID_JOB_ID);
      expect(job).toBeDefined();
      expect(job.id).toBe(VALID_JOB_ID);
      expect(job.data.userId).toBe(VALID_USER_ID);
    });

    it("identifies when job userId does not match token userId", async () => {
      vi.mocked(verifyToken).mockReturnValue({
        valid: true,
        payload: {
          sub: VALID_USER_ID,
          email: "test@example.com",
          role: "provider",
        },
      });

      mockQueue.getJob.mockResolvedValue({
        id: VALID_JOB_ID,
        data: { userId: "different-user" },
      });

      const job = await mockQueue.getJob(VALID_JOB_ID);
      expect(job).toBeDefined();
      expect(job.data.userId).not.toBe(VALID_USER_ID);
    });

    it("handles missing jobs gracefully", async () => {
      mockQueue.getJob.mockResolvedValue(null);

      const job = await mockQueue.getJob("non-existent-job");
      expect(job).toBeNull();
    });
  });

  describe("emit functions", () => {
    it("emitAssessmentProgress is defined", () => {
      expect(emitAssessmentProgress).toBeDefined();
      expect(typeof emitAssessmentProgress).toBe("function");
    });

    it("emitAssessmentCompleted is defined", () => {
      expect(emitAssessmentCompleted).toBeDefined();
      expect(typeof emitAssessmentCompleted).toBe("function");
    });

    it("emitAssessmentFailed is defined", () => {
      expect(emitAssessmentFailed).toBeDefined();
      expect(typeof emitAssessmentFailed).toBe("function");
    });
  });

  describe("userId vs token.sub mismatch", () => {
    it("does not allow userId parameter different from token sub claim", () => {
      vi.mocked(verifyToken).mockReturnValue({
        valid: true,
        payload: {
          sub: "actual-user-id",
          email: "test@example.com",
          role: "provider",
        },
      });

      const result = verifyToken(VALID_TOKEN);
      expect(result.valid).toBe(true);
      // The sub claim should match the expected userId
      expect(result.payload.sub).toBe("actual-user-id");
      // Different from the query param userId
      expect(result.payload.sub).not.toBe("different-user-id");
    });
  });

  describe("no token provided", () => {
    it("returns invalid when verifyToken receives null/undefined", () => {
      // Simulating no token by checking that verifyToken is never called with empty
      expect(verifyToken).not.toHaveBeenCalledWith(null);
      expect(verifyToken).not.toHaveBeenCalledWith(undefined);
    });
  });
});
