import { describe, it, expect } from 'vitest';
import { safeParseDate } from './date_fix';

describe('date_fix utilities', () => {
  it('should parse valid date strings', () => {
    const validDate = '2024-01-01T00:00:00.000Z';
    const result = safeParseDate(validDate);
    expect(result).toBeInstanceOf(Date);
    expect(result?.toISOString()).toBe(validDate);
  });

  it('should return null for invalid date strings', () => {
    expect(safeParseDate('invalid-date')).toBeNull();
    expect(safeParseDate('')).toBeNull();
  });
});
