import { describe, expect, it } from 'vitest';
import { buildCalendarEvents, toIcs } from '@/lib/calendar';
import { blankBonus, blankCard, newId } from '@/lib/storage';
import { emptyData } from '@/lib/types';
import type { AppData, CardAccount } from '@/lib/types';

const NOW = '2026-09-05';

function data(cards: CardAccount[]): AppData {
  return { ...emptyData(), cards };
}

describe('buildCalendarEvents', () => {
  it('emits the fee and the decision date as separate entries', () => {
    const card = { ...blankCard('2024-11-20'), id: 'c1', productName: 'Venture X', annualFeeCents: 39_500 };
    const events = buildCalendarEvents(data([card]), NOW);
    const fee = events.find((e) => e.uid.startsWith('fee-c1'));
    const review = events.find((e) => e.uid.startsWith('fee-review-c1'));
    expect(fee?.date).toBe('2026-11-20');
    // 45 days ahead by default -- the date that is actually actionable.
    expect(review?.date).toBe('2026-10-06');
  });

  it('includes a bonus deadline with the spend still needed', () => {
    const card = { ...blankCard('2026-08-01'), id: 'c2', productName: 'Ink' };
    card.bonus = {
      ...blankBonus(card),
      status: 'tracking',
      startDate: '2026-08-01',
      spendWindowMonths: 3,
      spendRequiredCents: 800_000,
      progressSource: 'manual',
      spendProgressCents: 200_000,
    };
    const events = buildCalendarEvents(data([card]), NOW);
    const bonus = events.find((e) => e.uid === 'bonus-c2');
    expect(bonus?.date).toBe('2026-11-01');
    expect(bonus?.description).toContain('$6,000.00');
  });

  it('includes an unused recurring credit', () => {
    const card = {
      ...blankCard('2024-01-01'),
      id: 'c3',
      productName: 'Platinum',
      perks: [{ id: 'p1', label: '$15 Uber Cash', valueCents: 1_500, period: 'monthly' as const, usedPeriods: [], notes: '' }],
    };
    const events = buildCalendarEvents(data([card]), NOW);
    const perk = events.find((e) => e.uid.startsWith('perk-c3'));
    expect(perk?.date).toBe('2026-09-30');
    expect(perk?.title).toContain('$15 Uber Cash');
  });

  it('leaves out a credit already used this period', () => {
    const card = {
      ...blankCard('2024-01-01'),
      id: 'c3',
      productName: 'Platinum',
      perks: [{ id: 'p1', label: 'Credit', valueCents: 1_500, period: 'monthly' as const, usedPeriods: ['2026-M09'], notes: '' }],
    };
    expect(
      buildCalendarEvents(data([card]), NOW).filter((e) => e.uid.startsWith('perk-')),
    ).toHaveLength(0);
  });

  it('comes out in date order', () => {
    const a = { ...blankCard('2024-10-01'), id: 'a', productName: 'A', annualFeeCents: 9_500 };
    const b = { ...blankCard('2024-12-01'), id: 'b', productName: 'B', annualFeeCents: 9_500 };
    const dates = buildCalendarEvents(data([a, b]), NOW).map((e) => e.date);
    expect(dates).toEqual([...dates].sort());
  });

  it('stops at the horizon', () => {
    const card = { ...blankCard('2024-11-20'), id: 'c1', productName: 'X', annualFeeCents: 9_500 };
    expect(buildCalendarEvents(data([card]), NOW, 10)).toHaveLength(0);
  });
});

describe('toIcs', () => {
  const events = [
    { uid: 'e1', date: '2026-11-20', title: 'Venture X — $395.00 annual fee', description: 'Year 2, decide before it posts' },
  ];

  it('produces a well-formed calendar', () => {
    const ics = toIcs(events, new Date('2026-09-05T12:00:00Z'));
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('DTSTART;VALUE=DATE:20261120');
    // An all-day DTEND is exclusive, so it is the next day.
    expect(ics).toContain('DTEND;VALUE=DATE:20261121');
    expect(ics).toContain('BEGIN:VALARM');
    expect(ics).toContain('TRIGGER:-P1D');
  });

  it('uses CRLF line endings, as the spec requires', () => {
    const ics = toIcs(events);
    expect(ics.split('\r\n').length).toBeGreaterThan(10);
    expect(/[^\r]\n/.test(ics)).toBe(false);
  });

  it('escapes commas so a title cannot break the field', () => {
    const ics = toIcs([{ uid: 'x', date: '2026-01-01', title: 'A, B', description: 'C; D' }]);
    expect(ics).toContain('A\\, B');
    expect(ics).toContain('C\; D');
  });

  it('folds a long line rather than emitting it over the limit', () => {
    const long = 'x'.repeat(300);
    const ics = toIcs([{ uid: 'x', date: '2026-01-01', title: long, description: '' }]);
    for (const line of ics.split('\r\n')) {
      expect(line.length).toBeLessThanOrEqual(75);
    }
  });

  it('emits a valid empty calendar', () => {
    const ics = toIcs([]);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).not.toContain('BEGIN:VEVENT');
  });
});
