import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  addYears,
  daysBetween,
  isIsoDate,
  monthsBetween,
} from '@/lib/dates';

describe('isIsoDate', () => {
  it('accepts a real date', () => {
    expect(isIsoDate('2024-03-15')).toBe(true);
  });

  it('rejects a day that does not exist in that month', () => {
    // Date.UTC would silently roll this into March.
    expect(isIsoDate('2024-02-30')).toBe(false);
    expect(isIsoDate('2023-02-29')).toBe(false);
  });

  it('accepts a real leap day', () => {
    expect(isIsoDate('2024-02-29')).toBe(true);
  });

  it('rejects wrong shapes', () => {
    expect(isIsoDate('3/15/2024')).toBe(false);
    expect(isIsoDate('2024-3-15')).toBe(false);
    expect(isIsoDate(undefined)).toBe(false);
  });
});

describe('addMonths', () => {
  it('clamps to the end of a shorter month', () => {
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29');
    expect(addMonths('2023-01-31', 1)).toBe('2023-02-28');
    expect(addMonths('2024-03-31', 1)).toBe('2024-04-30');
  });

  it('counts a three-month bonus window in calendar months, not 90 days', () => {
    // Feb 1 + 3 months is May 1, which is 89 days -- a 90-day approximation
    // would put the deadline a day late.
    expect(addMonths('2024-02-01', 3)).toBe('2024-05-01');
    expect(daysBetween('2024-02-01', '2024-05-01')).toBe(90);
    expect(addMonths('2023-02-01', 3)).toBe('2023-05-01');
    expect(daysBetween('2023-02-01', '2023-05-01')).toBe(89);
  });

  it('goes backwards', () => {
    expect(addMonths('2024-03-15', -24)).toBe('2022-03-15');
  });

  it('crosses a year boundary', () => {
    expect(addMonths('2024-11-15', 3)).toBe('2025-02-15');
  });
});

describe('addYears', () => {
  it('lands on the same day the following year', () => {
    expect(addYears('2024-03-15', 1)).toBe('2025-03-15');
  });

  it('clamps a leap-day anniversary to Feb 28', () => {
    expect(addYears('2024-02-29', 1)).toBe('2025-02-28');
    expect(addYears('2024-02-29', 4)).toBe('2028-02-29');
  });
});

describe('daysBetween', () => {
  it('is negative looking backwards', () => {
    expect(daysBetween('2024-03-15', '2024-03-10')).toBe(-5);
  });

  it('does not drift across a daylight-saving change', () => {
    // US DST starts 2024-03-10. A local-time implementation returns 30.958...
    // here and rounds wrong on either side.
    expect(daysBetween('2024-03-01', '2024-04-01')).toBe(31);
    expect(daysBetween('2024-10-15', '2024-11-15')).toBe(31);
  });
});

describe('monthsBetween', () => {
  it('ignores the partial month', () => {
    expect(monthsBetween('2024-01-15', '2024-03-14')).toBe(1);
    expect(monthsBetween('2024-01-15', '2024-03-15')).toBe(2);
  });
});

describe('addDays', () => {
  it('crosses a month boundary', () => {
    expect(addDays('2024-02-28', 2)).toBe('2024-03-01');
  });
});
