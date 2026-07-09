import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks ────────────────────────────────────────────────────────

const { mockQueueAdd, mockGetAssessmentQueue } = vi.hoisted(() => {
  const mockQueueAdd = vi.fn();
  const mockGetAssessmentQueue = vi.fn();
  return { mockQueueAdd, mockGetAssessmentQueue };
});

vi.mock("../queue", () => ({
  getAssessmentQueue: mockGetAssessmentQueue,
}));

vi.mock("../logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

// ── Subject under test ──────────────────────────────────────────────────

import { createAssessment } from "./assessments.controller";
import { MLService } from "../services/mlService";

function makeReqRes(body: any, userId = "user-1") {
  const req: any = {
    body,
    session: { user: { id: userId, email: `${userId}@example.com` } },
  };
  const res: any = {
    statusCode: undefined,
    body: undefined,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
  };
  return { req, res };
}

describe("createAssessment — dedup fingerprint lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    MLService.activeInferenceRequests.clear();
    mockGetAssessmentQueue.mockReturnValue({ add: mockQueueAdd });
  });

  it("keeps the fingerprint reserved after the job is enqueued (does not delete it in the HTTP handler)", async () => {
    mockQueueAdd.mockResolvedValue({ id: "job-1" });

    const input = { patientName: "Alice", age: 40 };
    const { req, res } = makeReqRes(input);

    await createAssessment(req, res);

    expect(res.statusCode).toBe(202);
    const fingerprint = MLService.generateRequestFingerprint(input, "user-1");
    // The fingerprint must still be reserved once the HTTP handler returns —
    // it is only the worker's job to release it once processing finishes.
    expect(MLService.activeInferenceRequests.has(fingerprint)).toBe(true);
  });

  it("passes requestFingerprint through as part of the job payload", async () => {
    mockQueueAdd.mockResolvedValue({ id: "job-2" });

    const input = { patientName: "Bob", age: 55 };
    const { req, res } = makeReqRes(input);

    await createAssessment(req, res);

    const fingerprint = MLService.generateRequestFingerprint(input, "user-1");
    expect(mockQueueAdd).toHaveBeenCalledWith(
      "predict",
      expect.objectContaining({ requestFingerprint: fingerprint }),
    );
  });

  it("rejects a concurrent duplicate submission while the first job is still in flight", async () => {
    mockQueueAdd.mockResolvedValue({ id: "job-3" });

    const input = { patientName: "Carol", age: 60 };
    const { req: req1, res: res1 } = makeReqRes(input);
    const { req: req2, res: res2 } = makeReqRes(input);

    await createAssessment(req1, res1);
    expect(res1.statusCode).toBe(202);

    // Because the fingerprint was NOT cleared after enqueue, a second
    // identical request arriving before the worker finishes is correctly
    // rejected instead of also being enqueued.
    await createAssessment(req2, res2);
    expect(res2.statusCode).toBe(409);

    expect(mockQueueAdd).toHaveBeenCalledTimes(1);
  });

  it("releases the fingerprint if the queue is unavailable so the request can be retried", async () => {
    mockGetAssessmentQueue.mockReturnValue(null);

    const input = { patientName: "Dave", age: 33 };
    const { req, res } = makeReqRes(input);

    await createAssessment(req, res);

    expect(res.statusCode).toBe(503);
    const fingerprint = MLService.generateRequestFingerprint(input, "user-1");
    expect(MLService.activeInferenceRequests.has(fingerprint)).toBe(false);
  });

  it("releases the fingerprint if queue.add itself throws before the job is enqueued", async () => {
    mockQueueAdd.mockRejectedValue(new Error("redis unreachable"));

    const input = { patientName: "Erin", age: 29 };
    const { req, res } = makeReqRes(input);

    await createAssessment(req, res);

    expect(res.statusCode).toBe(500);
    const fingerprint = MLService.generateRequestFingerprint(input, "user-1");
    expect(MLService.activeInferenceRequests.has(fingerprint)).toBe(false);
  });
});