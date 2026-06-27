import { describe, it, expect, vi, beforeEach } from "vitest";
import { logAccessAttempt, type AuditEvent } from './access-audit';

const { mockLogger, mockRecordPatientAccess } = vi.hoisted(() => {
  return {
    mockLogger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    mockRecordPatientAccess: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('../logger', () => ({
  logger: mockLogger,
}));

vi.mock('../storage', () => ({
  storage: {
    recordPatientAccess: mockRecordPatientAccess,
  },
}));

describe('logAccessAttempt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls logger.info when access is granted', () => {
    logAccessAttempt('user-1', 'Assessment', 42, true, 'Owner check passed');

    expect(mockLogger.info).toHaveBeenCalledTimes(1);
    const [meta, msg] = mockLogger.info.mock.calls[0];
    expect(meta.audit.type).toBe('ACCESS_GRANTED');
    expect(meta.audit.userId).toBe('user-1');
    expect(meta.audit.resourceType).toBe('Assessment');
    expect(meta.audit.resourceId).toBe(42);
    expect(msg).toBe('Access Granted');
  });

  it('calls logger.warn when access is denied', () => {
    logAccessAttempt('user-1', 'Patient', 'abc-99', false, 'Not authorized');

    expect(mockLogger.warn).toHaveBeenCalledTimes(1);
    const [meta, msg] = mockLogger.warn.mock.calls[0];
    expect(meta.audit.type).toBe('ACCESS_DENIED');
    expect(meta.security).toBe(true);
    expect(msg).toBe('Access Denied');
  });

  it('includes authMethod when provided', () => {
    logAccessAttempt('user-1', 'Assessment', 1, true, 'OK', 'jwt');

    const audit: AuditEvent = mockLogger.info.mock.calls[0][0].audit;
    expect(audit.authMethod).toBe('jwt');
  });

  it('omits authMethod when not provided', () => {
    logAccessAttempt('user-1', 'Assessment', 1, true, 'OK');

    const audit: AuditEvent = mockLogger.info.mock.calls[0][0].audit;
    expect(audit.authMethod).toBeUndefined();
  });

  it('accepts string resourceId', () => {
    logAccessAttempt('user-1', 'Patient', 'patient-uuid-123', false, 'Not found');

    const audit: AuditEvent = mockLogger.warn.mock.calls[0][0].audit;
    expect(audit.resourceId).toBe('patient-uuid-123');
  });

  it('calls storage.recordPatientAccess when available', async () => {
    logAccessAttempt('user-1', 'Assessment', 42, true, 'Owner check passed');

    await new Promise(resolve => setImmediate(resolve));

    expect(mockRecordPatientAccess).toHaveBeenCalledTimes(1);
    expect(mockRecordPatientAccess.mock.calls[0][0].userId).toBe('user-1');
    expect(mockRecordPatientAccess.mock.calls[0][0].resourceType).toBe('Assessment');
    expect(mockRecordPatientAccess.mock.calls[0][0].granted).toBe(true);
  });

  it('handles storage.recordPatientAccess failure gracefully', async () => {
    mockRecordPatientAccess.mockRejectedValueOnce(new Error('DB error'));

    // Should not throw
    logAccessAttempt('user-1', 'Assessment', 42, false, 'Forbidden');

    await new Promise(resolve => setImmediate(resolve));

    expect(mockLogger.error).toHaveBeenCalledTimes(1);
  });
});
