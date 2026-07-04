import { describe, it, expect, vi } from 'vitest';
import * as reactQuery from '@tanstack/react-query';
import { useAssessments, usePatientAssessments } from './use-assessments';

// Mock react-query
vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
  useInfiniteQuery: vi.fn(),
  useMutation: vi.fn(),
  useQueryClient: vi.fn(() => ({
    removeQueries: vi.fn(),
    invalidateQueries: vi.fn(),
  })),
}));

// Mock useToast
vi.mock('./use-toast', () => ({
  useToast: vi.fn(() => ({ toast: vi.fn() })),
}));

describe('useAssessments', () => {
  it('should call useQuery with correct queryKey for useAssessments', () => {
    const params = { page: 1, limit: 10 };
    useAssessments(params);
    expect(reactQuery.useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['/api/assessments', params],
      })
    );
  });
});

describe('usePatientAssessments', () => {
  it('should call useInfiniteQuery with patient name in queryKey', () => {
    usePatientAssessments('John Doe');
    expect(reactQuery.useInfiniteQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['assessments-patient', 'John Doe'],
        enabled: true,
      })
    );
  });

  it('should disable query when patientName is falsy', () => {
    usePatientAssessments(null);
    expect(reactQuery.useInfiniteQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['assessments-patient', ''],
        enabled: false,
      })
    );
  });
});
