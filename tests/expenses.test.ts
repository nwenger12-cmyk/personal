import { describe, expect, it } from 'vitest';
import { UNCATEGORIZED_ID } from '@/lib/categories';
import {
  deductibleCents,
  deductibleCentsFor,
  expensesToCsv,
  filterExpenses,
  importKeyFor,
  monthlyTotals,
  summaryToCsv,
  taxSummary,
  taxYearOf,
  taxYears,
  EMPTY_FILTER,
} from '@/lib/expenses';
import { blankExpense, withCategory } from '@/lib/storage';
import type { Entity, Expense } from '@/lib/types';

const BIZ: Entity = { id: 'biz', name: 'LocusStock', kind: 'business', notes: '' };
const PERSONAL: Entity = { id: 'me', name: 'Personal', kind: 'personal', notes: '' };
const ENTITIES = [BIZ, PERSONAL];

function expense(overrides: Partial<Expense> = {}): Expense {
  return {
    ...blankExpense('biz', '2026-03-15'),
    amountCents: 10_000,
    categoryId: 'supplies',
    merchant: 'B&H PHOTO',
    ...overrides,
  };
}

describe('taxYearOf', () => {
  it('uses the calendar year of the transaction date', () => {
    expect(taxYearOf(expense({ date: '2026-03-15' }))).toBe(2026);
    // A cash-basis filer deducts in the year they paid, so a New Year's Eve
    // charge belongs to the closing year, not the one it posts in.
    expect(taxYearOf(expense({ date: '2025-12-31' }))).toBe(2025);
  });

  it('lists the years present, newest first', () => {
    expect(
      taxYears([
        expense({ date: '2024-05-01' }),
        expense({ date: '2026-01-01' }),
        expense({ date: '2026-08-01' }),
      ]),
    ).toEqual([2026, 2024]);
  });
});

describe('deductibleCents', () => {
  it('applies the percentage', () => {
    expect(deductibleCents(expense({ amountCents: 10_000, deductiblePercent: 100 }))).toBe(10_000);
    expect(deductibleCents(expense({ amountCents: 10_000, deductiblePercent: 50 }))).toBe(5_000);
    expect(deductibleCents(expense({ amountCents: 7_425, deductiblePercent: 60 }))).toBe(4_455);
  });

  it('rounds to whole cents rather than carrying a fraction', () => {
    expect(deductibleCents(expense({ amountCents: 3_333, deductiblePercent: 50 }))).toBe(1_667);
  });

  it('clamps a percentage outside 0-100', () => {
    expect(deductibleCents(expense({ amountCents: 10_000, deductiblePercent: 150 }))).toBe(10_000);
    expect(deductibleCents(expense({ amountCents: 10_000, deductiblePercent: -20 }))).toBe(0);
  });
});

describe('withCategory', () => {
  it("adopts the new category's default percentage", () => {
    // Moving Supplies (100%) to Meals has to pick up the 50% statutory cap,
    // not silently keep deducting the whole thing.
    const moved = withCategory(expense({ deductiblePercent: 100 }), 'meals');
    expect(moved.categoryId).toBe('meals');
    expect(moved.deductiblePercent).toBe(50);
  });

  it('leaves the percentage alone for an unknown category', () => {
    const moved = withCategory(expense({ deductiblePercent: 60 }), 'nonsense');
    expect(moved.deductiblePercent).toBe(60);
  });
});

describe('importKeyFor', () => {
  it('is stable for the same transaction', () => {
    expect(importKeyFor('2026-03-15', 10_000, 'B&H PHOTO VIDEO')).toBe(
      importKeyFor('2026-03-15', 10_000, 'B&H  photo  video!'),
    );
  });

  it('differs when any part differs', () => {
    const base = importKeyFor('2026-03-15', 10_000, 'B&H');
    expect(importKeyFor('2026-03-16', 10_000, 'B&H')).not.toBe(base);
    expect(importKeyFor('2026-03-15', 10_001, 'B&H')).not.toBe(base);
    expect(importKeyFor('2026-03-15', 10_000, 'ADORAMA')).not.toBe(base);
  });
});

describe('filterExpenses', () => {
  const rows = [
    expense({ id: '1', date: '2026-03-15', merchant: 'ADOBE', categoryId: 'software' }),
    expense({ id: '2', date: '2026-07-01', merchant: 'DELTA', categoryId: 'travel', entityId: 'me' }),
    expense({ id: '3', date: '2025-11-02', merchant: 'ADOBE', categoryId: 'software' }),
    expense({ id: '4', date: '2026-01-09', merchant: 'MYSTERY', categoryId: UNCATEGORIZED_ID, reviewed: false }),
  ];

  it('returns newest first', () => {
    expect(filterExpenses(rows, EMPTY_FILTER).map((e) => e.id)).toEqual(['2', '1', '4', '3']);
  });

  it('filters by tax year', () => {
    expect(filterExpenses(rows, { ...EMPTY_FILTER, year: 2025 }).map((e) => e.id)).toEqual(['3']);
  });

  it('filters by entity and by category', () => {
    expect(filterExpenses(rows, { ...EMPTY_FILTER, entityId: 'me' }).map((e) => e.id)).toEqual(['2']);
    expect(filterExpenses(rows, { ...EMPTY_FILTER, categoryId: 'software' }).map((e) => e.id))
      .toEqual(['1', '3']);
  });

  it('searches merchant text case-insensitively', () => {
    expect(filterExpenses(rows, { ...EMPTY_FILTER, query: 'adobe' }).map((e) => e.id))
      .toEqual(['1', '3']);
  });

  it('isolates the review queue', () => {
    expect(filterExpenses(rows, { ...EMPTY_FILTER, needsReviewOnly: true }).map((e) => e.id))
      .toEqual(['4']);
  });

  it('combines filters', () => {
    expect(
      filterExpenses(rows, { ...EMPTY_FILTER, year: 2026, categoryId: 'software' }).map((e) => e.id),
    ).toEqual(['1']);
  });
});

describe('taxSummary', () => {
  const rows = [
    expense({ date: '2026-02-01', amountCents: 20_000, categoryId: 'software' }),
    expense({ date: '2026-03-01', amountCents: 5_000, categoryId: 'cloud-hosting' }),
    expense({ date: '2026-04-01', amountCents: 10_000, categoryId: 'meals', deductiblePercent: 50 }),
    expense({ date: '2026-05-01', amountCents: 30_000, categoryId: 'travel' }),
    expense({ date: '2026-06-01', amountCents: 7_000, categoryId: UNCATEGORIZED_ID }),
    expense({ date: '2025-06-01', amountCents: 99_900, categoryId: 'travel' }),
    expense({ date: '2026-06-15', amountCents: 4_000, categoryId: 'office', entityId: 'me' }),
  ];

  it('only counts the year asked for', () => {
    const summary = taxSummary(rows, ENTITIES, 2026);
    // The 2025 travel charge stays out of it.
    expect(summary.grossCents).toBe(20_000 + 5_000 + 10_000 + 30_000 + 4_000);
  });

  it('applies each expense percentage to the deductible total', () => {
    const summary = taxSummary(rows, ENTITIES, 2026);
    // The meal is halved by its 50% cap, and the $40 filed to the personal
    // entity contributes nothing -- personal spending is not deductible.
    expect(summary.deductibleCents).toBe(20_000 + 5_000 + 5_000 + 30_000);
  });

  it('keeps uncategorised spend out of the totals but reports it', () => {
    const summary = taxSummary(rows, ENTITIES, 2026);
    expect(summary.uncategorizedCount).toBe(1);
    expect(summary.uncategorizedCents).toBe(7_000);
    const allCategories = summary.entities.flatMap((e) =>
      e.lines.flatMap((l) => l.categories.map((c) => c.category.id)),
    );
    expect(allCategories).not.toContain(UNCATEGORIZED_ID);
  });

  it('splits by entity so two businesses get two sets of totals', () => {
    const summary = taxSummary(rows, ENTITIES, 2026);
    expect(summary.entities.map((e) => e.entity.id)).toEqual(['biz', 'me']);
    expect(summary.entities[1].grossCents).toBe(4_000);
  });

  it('leaves out an entity with nothing in the year', () => {
    const summary = taxSummary([expense({ date: '2026-02-01' })], ENTITIES, 2026);
    expect(summary.entities.map((e) => e.entity.id)).toEqual(['biz']);
  });

  it('rolls several categories onto one Schedule C line', () => {
    // Software and cloud hosting both print on line 27a.
    const summary = taxSummary(rows, ENTITIES, 2026);
    const other = summary.entities[0].lines.find((l) => l.scheduleCLine.startsWith('Line 27a'));
    expect(other?.categories.map((c) => c.category.id).sort()).toEqual([
      'cloud-hosting',
      'software',
    ]);
    expect(other?.grossCents).toBe(25_000);
  });

  it('orders lines the way the form does', () => {
    const summary = taxSummary(rows, ENTITIES, 2026);
    const orders = summary.entities[0].lines.map((l) => l.lineOrder);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
  });

  it('counts unreviewed rows without excluding them', () => {
    const summary = taxSummary(
      [expense({ date: '2026-02-01', amountCents: 1_000, reviewed: false })],
      ENTITIES,
      2026,
    );
    expect(summary.entities[0].unreviewedCount).toBe(1);
    expect(summary.entities[0].grossCents).toBe(1_000);
  });
});

describe('monthlyTotals', () => {
  it('buckets by month of the requested year', () => {
    const months = monthlyTotals(
      [
        expense({ date: '2026-01-05', amountCents: 1_000 }),
        expense({ date: '2026-01-20', amountCents: 2_000 }),
        expense({ date: '2026-12-31', amountCents: 500 }),
        expense({ date: '2025-01-05', amountCents: 9_999 }),
      ],
      2026,
    );
    expect(months).toHaveLength(12);
    expect(months[0]).toBe(3_000);
    expect(months[11]).toBe(500);
    expect(months.reduce((a, b) => a + b, 0)).toBe(3_500);
  });
});

describe('csv export', () => {
  it('carries gross, percentage and deductible as separate columns', () => {
    const csv = expensesToCsv(
      [expense({ date: '2026-04-01', amountCents: 10_000, categoryId: 'meals', deductiblePercent: 50 })],
      ENTITIES,
      {},
    );
    const [header, row] = csv.split('\n');
    expect(header).toContain('Deductible amount');
    expect(row).toContain('100.00');
    expect(row).toContain('50');
    expect(row).toContain('50.00');
    expect(row).toContain('Line 24b — Deductible meals');
  });

  it('quotes a field containing a comma', () => {
    const csv = expensesToCsv(
      [expense({ merchant: 'ACME, INC', description: 'said "hi"' })],
      ENTITIES,
      {},
    );
    expect(csv).toContain('"ACME, INC"');
    expect(csv).toContain('"said ""hi"""');
  });

  it('flags uncategorised spend in the summary export instead of hiding it', () => {
    const csv = summaryToCsv(
      taxSummary([expense({ date: '2026-01-01', categoryId: UNCATEGORIZED_ID })], ENTITIES, 2026),
    );
    expect(csv).toContain('UNCATEGORISED — excluded from totals');
  });
});

describe('personal entities', () => {
  const rows = [
    expense({ date: '2026-02-01', amountCents: 20_000, categoryId: 'software' }),
    expense({ date: '2026-03-01', amountCents: 8_000, categoryId: 'office', entityId: 'me' }),
  ];

  it('contributes nothing to any deductible total', () => {
    // Personal spending is not deductible on a business return. Tracking its
    // gross keeps the year complete; counting it as deductible would put a
    // wrong number on a form.
    const summary = taxSummary(rows, ENTITIES, 2026);
    const personal = summary.entities.find((e) => e.entity.id === 'me');
    expect(personal?.grossCents).toBe(8_000);
    expect(personal?.deductibleCents).toBe(0);
    expect(summary.deductibleCents).toBe(20_000);
  });

  it('still shows up per line so the split is visible', () => {
    const summary = taxSummary(rows, ENTITIES, 2026);
    const personal = summary.entities.find((e) => e.entity.id === 'me');
    expect(personal?.lines[0].grossCents).toBe(8_000);
    expect(personal?.lines[0].deductibleCents).toBe(0);
  });

  it('zeroes the deductible column in the row export too', () => {
    const csv = expensesToCsv(rows, ENTITIES, {});
    const columns = csv.split('\n').find((r) => r.includes('Personal'))?.split(',');
    // Gross is preserved; the percentage and the deductible amount are zero.
    expect(columns?.slice(8, 11)).toEqual(['80.00', '0', '0.00']);
  });
});

describe('deductibleCentsFor', () => {
  it('is the percentage arithmetic for a business entity', () => {
    expect(
      deductibleCentsFor(
        expense({ amountCents: 10_000, deductiblePercent: 50, entityId: 'biz' }),
        ENTITIES,
      ),
    ).toBe(5_000);
  });

  it('is zero for a personal entity regardless of the percentage', () => {
    expect(
      deductibleCentsFor(
        expense({ amountCents: 10_000, deductiblePercent: 100, entityId: 'me' }),
        ENTITIES,
      ),
    ).toBe(0);
  });

  it('treats an unknown entity as deductible rather than silently zeroing it', () => {
    // A dangling entity id is a data problem to notice, not a reason to make
    // a real expense vanish from the totals.
    expect(
      deductibleCentsFor(
        expense({ amountCents: 10_000, deductiblePercent: 100, entityId: 'gone' }),
        ENTITIES,
      ),
    ).toBe(10_000);
  });
});

describe('uncategorised rows never show a deductible amount', () => {
  it('is zero until a category is assigned', () => {
    // The summary excludes uncategorised spend from its line totals, so the
    // list view has to agree or the two screens contradict each other.
    const row = expense({ categoryId: UNCATEGORIZED_ID, amountCents: 24_000, entityId: 'biz' });
    expect(deductibleCentsFor(row, ENTITIES)).toBe(0);
    expect(deductibleCentsFor(withCategory(row, 'supplies'), ENTITIES)).toBe(24_000);
  });

  it('is left out of the row export too', () => {
    const csv = expensesToCsv(
      [expense({ categoryId: UNCATEGORIZED_ID, amountCents: 24_000, merchant: 'MYSTERY' })],
      ENTITIES,
      {},
    );
    const columns = csv.split('\n').find((r) => r.includes('MYSTERY'))?.split(',');
    expect(columns?.slice(8, 11)).toEqual(['240.00', '100', '0.00']);
  });
});
