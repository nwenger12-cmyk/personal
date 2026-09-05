import { toUtcMs } from './dates';
import type { IsoDate } from './dates';
import { EXPENSE_CATEGORIES, UNCATEGORIZED_ID, getCategory } from './categories';
import type { ExpenseCategory } from './categories';
import { cardLabel } from './fees';
import type { CardAccount, Entity, Expense } from './types';

/**
 * Totalling spend for a tax year.
 *
 * Two rules shape everything here. First, an expense belongs to the calendar
 * year of the transaction date -- that is the year it is deducted in for a
 * cash-basis filer, which is nearly everyone filing a Schedule C. Second,
 * anything still uncategorised is counted and reported but kept OUT of the
 * line totals: a summary that quietly folded unfiled spend into a number you
 * copy onto a form would be worse than one that says what it does not know.
 */

export function taxYearOf(expense: Expense): number {
  return Number(expense.date.slice(0, 4));
}

/** The deductible portion, in cents, after the percentage is applied. */
export function deductibleCents(expense: Expense): number {
  const pct = Math.max(0, Math.min(100, expense.deductiblePercent));
  return Math.round((expense.amountCents * pct) / 100);
}

/**
 * The deductible portion as it actually counts, which is zero in two cases the
 * bare percentage does not know about:
 *
 *   - the expense is filed to a personal entity, and personal spending is not
 *     deductible on a business return;
 *   - it is still uncategorised, and the tax summary excludes those from every
 *     line total rather than folding unfiled spend into a number you copy onto
 *     a form.
 *
 * Use this anywhere a deductible figure is shown or totalled. `deductibleCents`
 * above is only the percentage arithmetic, and using it directly is how the
 * list view and the summary end up disagreeing.
 */
export function deductibleCentsFor(expense: Expense, entities: Entity[]): number {
  if (expense.categoryId === UNCATEGORIZED_ID) return 0;
  const entity = entities.find((e) => e.id === expense.entityId);
  return entity?.kind === 'personal' ? 0 : deductibleCents(expense);
}

/**
 * A stable identity for an imported row, so re-importing a statement that
 * overlaps one already loaded updates the existing expense rather than
 * doubling it. Date, amount and a squashed merchant string: two genuinely
 * distinct charges at the same merchant for the same amount on the same day
 * are rare enough, and the review queue surfaces them if it happens.
 */
export function importKeyFor(
  date: IsoDate,
  amountCents: number,
  merchant: string,
): string {
  const squashed = merchant.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 24);
  return `${date}|${amountCents}|${squashed}`;
}

export function taxYears(expenses: Expense[]): number[] {
  const years = new Set(expenses.map(taxYearOf));
  return [...years].sort((a, b) => b - a);
}

export type ExpenseFilter = {
  year: number | null;
  entityId: string | null;
  categoryId: string | null;
  /** Matches merchant, description and notes. */
  query: string;
  /** Only rows that have not been confirmed yet. */
  needsReviewOnly: boolean;
};

export const EMPTY_FILTER: ExpenseFilter = {
  year: null,
  entityId: null,
  categoryId: null,
  query: '',
  needsReviewOnly: false,
};

export function filterExpenses(expenses: Expense[], filter: ExpenseFilter): Expense[] {
  const q = filter.query.trim().toLowerCase();
  return expenses
    .filter((e) => (filter.year === null ? true : taxYearOf(e) === filter.year))
    .filter((e) => (filter.entityId === null ? true : e.entityId === filter.entityId))
    .filter((e) => (filter.categoryId === null ? true : e.categoryId === filter.categoryId))
    .filter((e) => (filter.needsReviewOnly ? !e.reviewed : true))
    .filter((e) =>
      q === ''
        ? true
        : `${e.merchant} ${e.description} ${e.notes}`.toLowerCase().includes(q),
    )
    .sort((a, b) => toUtcMs(b.date) - toUtcMs(a.date));
}

// ---- tax summary ------------------------------------------------------------

export type CategoryTotal = {
  category: ExpenseCategory;
  grossCents: number;
  deductibleCents: number;
  count: number;
};

export type LineTotal = {
  scheduleCLine: string;
  lineOrder: number;
  categories: CategoryTotal[];
  grossCents: number;
  deductibleCents: number;
  count: number;
};

export type EntitySummary = {
  entity: Entity;
  lines: LineTotal[];
  /** Categorised spend only -- what the line totals below add up to. */
  grossCents: number;
  /** Everything filed to this entity, categorised or not. */
  totalSpentCents: number;
  deductibleCents: number;
  count: number;
  /** Excluded from the line totals above, and reported so it is not silent. */
  uncategorizedCount: number;
  uncategorizedCents: number;
  /** Categorised but not yet confirmed. Included in totals, flagged as soft. */
  unreviewedCount: number;
};

export type TaxSummary = {
  year: number;
  entities: EntitySummary[];
  grossCents: number;
  deductibleCents: number;
  count: number;
  uncategorizedCount: number;
  uncategorizedCents: number;
};

function summarizeEntity(entity: Entity, expenses: Expense[]): EntitySummary {
  // Spending filed to a personal entity is not deductible on a business
  // return, so it contributes zero to every deductible figure -- here, on the
  // dashboard, and in the exports. Its gross is still tracked, so the year is
  // complete and the split is visible. Anything that genuinely belongs to a
  // business is filed to a business entity; that choice is what the entity
  // kind is for.
  const deductibleOf = (expense: Expense) =>
    entity.kind === 'personal' ? 0 : deductibleCents(expense);

  const byCategory = new Map<string, CategoryTotal>();
  let uncategorizedCount = 0;
  let uncategorizedCents = 0;
  let unreviewedCount = 0;

  for (const expense of expenses) {
    if (!expense.reviewed) unreviewedCount += 1;

    if (expense.categoryId === UNCATEGORIZED_ID) {
      uncategorizedCount += 1;
      uncategorizedCents += expense.amountCents;
      continue;
    }

    const category = getCategory(expense.categoryId);
    if (!category) {
      uncategorizedCount += 1;
      uncategorizedCents += expense.amountCents;
      continue;
    }

    const existing = byCategory.get(category.id);
    const deductible = deductibleOf(expense);
    if (existing) {
      existing.grossCents += expense.amountCents;
      existing.deductibleCents += deductible;
      existing.count += 1;
    } else {
      byCategory.set(category.id, {
        category,
        grossCents: expense.amountCents,
        deductibleCents: deductible,
        count: 1,
      });
    }
  }

  // Roll categories up into the Schedule C line each one prints on, so several
  // "Other expenses" categories show as one line with its parts underneath.
  const byLine = new Map<string, LineTotal>();
  for (const total of byCategory.values()) {
    const key = total.category.scheduleCLine;
    const existing = byLine.get(key);
    if (existing) {
      existing.categories.push(total);
      existing.grossCents += total.grossCents;
      existing.deductibleCents += total.deductibleCents;
      existing.count += total.count;
      existing.lineOrder = Math.min(existing.lineOrder, total.category.lineOrder);
    } else {
      byLine.set(key, {
        scheduleCLine: key,
        lineOrder: total.category.lineOrder,
        categories: [total],
        grossCents: total.grossCents,
        deductibleCents: total.deductibleCents,
        count: total.count,
      });
    }
  }

  const lines = [...byLine.values()].sort((a, b) => a.lineOrder - b.lineOrder);
  for (const line of lines) {
    line.categories.sort((a, b) => b.deductibleCents - a.deductibleCents);
  }

  const grossCents = lines.reduce((sum, l) => sum + l.grossCents, 0);

  return {
    entity,
    lines,
    grossCents,
    totalSpentCents: grossCents + uncategorizedCents,
    deductibleCents: lines.reduce((sum, l) => sum + l.deductibleCents, 0),
    count: lines.reduce((sum, l) => sum + l.count, 0),
    uncategorizedCount,
    uncategorizedCents,
    unreviewedCount,
  };
}

export function taxSummary(
  expenses: Expense[],
  entities: Entity[],
  year: number,
): TaxSummary {
  const inYear = expenses.filter((e) => taxYearOf(e) === year);

  const entitySummaries = entities
    .map((entity) =>
      summarizeEntity(entity, inYear.filter((e) => e.entityId === entity.id)),
    )
    // An entity with nothing in this year is noise on the summary.
    .filter((s) => s.count > 0 || s.uncategorizedCount > 0);

  return {
    year,
    entities: entitySummaries,
    grossCents: entitySummaries.reduce((sum, s) => sum + s.grossCents, 0),
    deductibleCents: entitySummaries.reduce((sum, s) => sum + s.deductibleCents, 0),
    count: entitySummaries.reduce((sum, s) => sum + s.count, 0),
    uncategorizedCount: entitySummaries.reduce((sum, s) => sum + s.uncategorizedCount, 0),
    uncategorizedCents: entitySummaries.reduce((sum, s) => sum + s.uncategorizedCents, 0),
  };
}

/** Spend per month for a year, for the trend strip. Index 0 is January. */
export function monthlyTotals(expenses: Expense[], year: number): number[] {
  const months = new Array<number>(12).fill(0);
  for (const expense of expenses) {
    if (taxYearOf(expense) !== year) continue;
    const month = Number(expense.date.slice(5, 7)) - 1;
    if (month >= 0 && month < 12) months[month] += expense.amountCents;
  }
  return months;
}

// ---- CSV export -------------------------------------------------------------

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * A flat row-per-expense export for an accountant or for import into
 * bookkeeping software. Deliberately includes the gross amount, the
 * percentage, and the deductible amount as separate columns: an accountant
 * needs to see the judgement that was applied, not just its result.
 */
export function expensesToCsv(
  expenses: Expense[],
  entities: Entity[],
  cardLabels: Record<string, string>,
): string {
  const entityNames = new Map(entities.map((e) => [e.id, e.name]));
  const entityKinds = new Map(entities.map((e) => [e.id, e.kind]));
  const header = [
    'Date', 'Tax year', 'Entity', 'Entity type', 'Merchant', 'Description',
    'Category', 'Schedule C line', 'Amount', 'Deductible %', 'Deductible amount',
    'Card', 'Reviewed', 'Receipt', 'Notes',
  ];

  const rows = expenses
    .slice()
    .sort((a, b) => toUtcMs(a.date) - toUtcMs(b.date))
    .map((e) => {
      const category = getCategory(e.categoryId);
      const entity = entities.find((x) => x.id === e.entityId);
      return [
        e.date,
        taxYearOf(e),
        entityNames.get(e.entityId) ?? 'Unassigned',
        entity?.kind ?? '',
        e.merchant,
        e.description,
        category?.label ?? 'Uncategorised',
        category?.scheduleCLine ?? '',
        (e.amountCents / 100).toFixed(2),
        entityKinds.get(e.entityId) === 'personal' ? 0 : e.deductiblePercent,
        (deductibleCentsFor(e, entities) / 100).toFixed(2),
        e.cardId ? cardLabels[e.cardId] ?? '' : '',
        e.reviewed ? 'yes' : 'no',
        e.receiptNote,
        e.notes,
      ].map(csvCell).join(',');
    });

  return [header.map(csvCell).join(','), ...rows].join('\n');
}

/** A category-total export matching the tax summary, for the return itself. */
export function summaryToCsv(summary: TaxSummary): string {
  const header = ['Entity', 'Entity type', 'Schedule C line', 'Category', 'Gross', 'Deductible', 'Transactions'];
  const rows: string[] = [];

  for (const entity of summary.entities) {
    for (const line of entity.lines) {
      for (const total of line.categories) {
        rows.push([
          entity.entity.name,
          entity.entity.kind,
          line.scheduleCLine,
          total.category.label,
          (total.grossCents / 100).toFixed(2),
          (total.deductibleCents / 100).toFixed(2),
          total.count,
        ].map(csvCell).join(','));
      }
    }
    if (entity.uncategorizedCount > 0) {
      rows.push([
        entity.entity.name,
        entity.entity.kind,
        'UNCATEGORISED — excluded from totals',
        'Uncategorised',
        (entity.uncategorizedCents / 100).toFixed(2),
        '0.00',
        entity.uncategorizedCount,
      ].map(csvCell).join(','));
    }
  }

  return [header.map(csvCell).join(','), ...rows].join('\n');
}

export const ALL_CATEGORY_IDS = EXPENSE_CATEGORIES.map((c) => c.id);

// ---- annual fees as expenses -----------------------------------------------

/**
 * An annual fee you have already recorded on a card is a deductible business
 * expense in its own right, and it is sitting in the app twice over -- once as
 * a fee charge, once as a line on the statement you imported. This turns the
 * recorded charges into expenses so it is captured without re-typing.
 *
 * Keyed off the fee-charge id so running it twice does not double anything,
 * and refunded fees are skipped -- a fee that came back is not an expense.
 */
export function feeChargeKey(cardId: string, chargeId: string): string {
  return `fee|${cardId}|${chargeId}`;
}

export function pendingFeeExpenses(
  cards: CardAccount[],
  expenses: Expense[],
  entityId: string,
): Expense[] {
  const recorded = new Set(expenses.map((e) => e.importKey).filter(Boolean) as string[]);
  const out: Expense[] = [];

  for (const card of cards) {
    // An authorized-user card's fee is on whoever owns the account.
    if (card.authorizedUser) continue;
    for (const charge of card.feeHistory) {
      if (charge.refunded) continue;
      if (charge.amountCents <= 0) continue;
      const key = feeChargeKey(card.id, charge.id);
      if (recorded.has(key)) continue;
      out.push({
        id: `fee-expense-${charge.id}`,
        date: charge.date,
        amountCents: charge.amountCents,
        merchant: `${cardLabel(card)} annual fee`,
        description: charge.note || 'Annual fee',
        entityId,
        categoryId: 'bank-fees',
        cardId: card.id,
        deductiblePercent: 100,
        reviewed: false,
        receiptNote: '',
        source: 'card-fee',
        importKey: key,
        notes: '',
      });
    }
  }

  return out.sort((a, b) => toUtcMs(b.date) - toUtcMs(a.date));
}
