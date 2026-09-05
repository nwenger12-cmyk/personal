import { activeBonuses } from './bonuses';
import { daysBetween, monthKey, today } from './dates';
import type { IsoDate } from './dates';
import { taxYearOf } from './expenses';
import { upcomingFees } from './fees';
import { getProgram } from './programs';
import type { AppData, CardAccount, Expense } from './types';

/**
 * One list of everything that has gone stale, so keeping this current is a
 * thing you glance at rather than a thing you have to remember.
 *
 * The hard part of a tracker like this is not the arithmetic, it is noticing
 * that you stopped feeding it in July. So the checks that matter most are the
 * ones about absence: a card with no recent transactions, a subscription that
 * has billed every month and suddenly has not, a points balance nobody has
 * touched since spring.
 */

export type Severity = 'now' | 'soon' | 'idle';

export type AttentionItem = {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
  href: string;
  actionLabel: string;
};

/** A card is considered current if something on it was imported this recently. */
const IMPORT_STALE_DAYS = 40;
/** Balances drift slowly, so this is a nudge rather than an alarm. */
const BALANCE_STALE_DAYS = 45;
/** A recurring charge this overdue means a statement was probably missed. */
const RECURRING_OVERDUE_DAYS = 45;

function normalizeMerchant(merchant: string): string {
  return merchant.toLowerCase().replace(/[^a-z]+/g, ' ').trim().slice(0, 20);
}

/**
 * Merchants that have billed in at least three separate months and then gone
 * quiet. A subscription does not simply stop, so the likely explanation is a
 * statement that never got imported.
 */
export function missingRecurring(
  expenses: Expense[],
  now: IsoDate = today(),
): { merchant: string; lastSeen: IsoDate; monthsSeen: number }[] {
  const groups = new Map<string, { merchant: string; months: Set<string>; last: IsoDate }>();

  for (const expense of expenses) {
    if (expense.amountCents <= 0) continue;
    const key = normalizeMerchant(expense.merchant);
    if (!key) continue;
    const existing = groups.get(key);
    if (existing) {
      existing.months.add(monthKey(expense.date));
      if (expense.date > existing.last) existing.last = expense.date;
    } else {
      groups.set(key, {
        merchant: expense.merchant,
        months: new Set([monthKey(expense.date)]),
        last: expense.date,
      });
    }
  }

  return [...groups.values()]
    .filter((g) => g.months.size >= 3)
    .filter((g) => daysBetween(g.last, now) > RECURRING_OVERDUE_DAYS)
    .map((g) => ({ merchant: g.merchant, lastSeen: g.last, monthsSeen: g.months.size }))
    .sort((a, b) => (a.lastSeen < b.lastSeen ? -1 : 1));
}

/** The most recent imported transaction on each card. */
export function lastImportByCard(expenses: Expense[]): Map<string, IsoDate> {
  const last = new Map<string, IsoDate>();
  for (const expense of expenses) {
    if (!expense.cardId) continue;
    const current = last.get(expense.cardId);
    if (!current || expense.date > current) last.set(expense.cardId, expense.date);
  }
  return last;
}

export function attentionItems(data: AppData, now: IsoDate = today()): AttentionItem[] {
  const items: AttentionItem[] = [];
  const { cards, expenses, balances, settings } = data;
  const openCards = cards.filter((c) => c.status === 'open' && !c.authorizedUser);

  // ---- things with a deadline ------------------------------------------------
  for (const fee of upcomingFees(cards, settings.feeReviewLeadDays, 12, now)) {
    if (fee.daysUntil > settings.feeReviewLeadDays) continue;
    items.push({
      id: `fee-${fee.cardId}-${fee.date}`,
      severity: fee.daysUntil <= 14 ? 'now' : 'soon',
      title: `${fee.cardLabel} annual fee in ${fee.daysUntil} days`,
      detail: 'Decide whether to keep, downgrade, or cancel before it posts.',
      href: `/cards?card=${fee.cardId}`,
      actionLabel: 'Open card',
    });
  }

  for (const tracked of activeBonuses(cards, settings.bonusWarnDays, now, expenses)) {
    const { outlook } = tracked;
    if (outlook.remainingCents === 0) {
      items.push({
        id: `bonus-done-${tracked.card.id}`,
        severity: 'soon',
        title: `${tracked.label} bonus requirement met`,
        detail: 'Mark it earned so it stops counting as spend still to do.',
        href: '/bonuses',
        actionLabel: 'Mark earned',
      });
      continue;
    }
    if (outlook.paceStatus === 'at-risk' || outlook.paceStatus === 'behind') {
      items.push({
        id: `bonus-${tracked.card.id}`,
        severity: outlook.paceStatus === 'at-risk' ? 'now' : 'soon',
        title: `${tracked.label} bonus is ${outlook.paceStatus === 'at-risk' ? 'close to its deadline' : 'behind pace'}`,
        detail:
          outlook.perDayNeededCents === null
            ? 'The window has closed.'
            : `${outlook.daysLeft} days left, and the pace needed has gone up.`,
        href: '/bonuses',
        actionLabel: 'See bonuses',
      });
    }
  }

  // ---- things that have gone quiet -------------------------------------------
  const lastImport = lastImportByCard(expenses);
  const staleCards: CardAccount[] = [];
  for (const card of openCards) {
    const last = lastImport.get(card.id);
    // A card that has never had anything imported is not stale, it is simply
    // not being tracked -- that is a different, quieter prompt below.
    if (!last) continue;
    if (daysBetween(last, now) > IMPORT_STALE_DAYS) staleCards.push(card);
  }
  if (staleCards.length > 0) {
    items.push({
      id: 'stale-imports',
      severity: 'soon',
      title: `${staleCards.length} ${staleCards.length === 1 ? 'card has' : 'cards have'} no recent transactions`,
      detail: `Nothing imported for over ${IMPORT_STALE_DAYS} days on ${staleCards
        .map((c) => c.nickname || c.productName)
        .join(', ')}.`,
      href: '/import',
      actionLabel: 'Import statements',
    });
  }

  const missing = missingRecurring(expenses, now);
  if (missing.length > 0) {
    items.push({
      id: 'missing-recurring',
      severity: 'soon',
      title: `${missing.length} recurring ${missing.length === 1 ? 'charge has' : 'charges have'} stopped appearing`,
      detail: `${missing
        .slice(0, 3)
        .map((m) => m.merchant)
        .join(', ')} billed every month and then stopped — usually a statement that was never imported.`,
      href: '/import',
      actionLabel: 'Import statements',
    });
  }

  const trackedCards = openCards.filter((c) => !lastImport.has(c.id));
  if (expenses.length > 0 && trackedCards.length > 0) {
    items.push({
      id: 'untracked-cards',
      severity: 'idle',
      title: `${trackedCards.length} ${trackedCards.length === 1 ? 'card is' : 'cards are'} not feeding spending`,
      detail: `No transactions have ever been imported for ${trackedCards
        .map((c) => c.nickname || c.productName)
        .join(', ')}.`,
      href: '/import',
      actionLabel: 'Import statements',
    });
  }

  // ---- things waiting on you -------------------------------------------------
  const unreviewed = expenses.filter((e) => !e.reviewed).length;
  if (unreviewed > 0) {
    items.push({
      id: 'unreviewed',
      severity: 'soon',
      title: `${unreviewed} ${unreviewed === 1 ? 'transaction needs' : 'transactions need'} a category`,
      detail: 'Uncategorised spend is excluded from the tax summary totals.',
      href: '/expenses',
      actionLabel: 'Review them',
    });
  }

  const staleBalances = balances.filter(
    (b) => daysBetween(b.updated, now) > BALANCE_STALE_DAYS,
  );
  if (staleBalances.length > 0) {
    items.push({
      id: 'stale-balances',
      severity: 'idle',
      title: `${staleBalances.length} points ${staleBalances.length === 1 ? 'balance is' : 'balances are'} out of date`,
      detail: `${staleBalances
        .map((b) => getProgram(b.programId)?.shortName ?? b.programId)
        .join(', ')} — no issuer exposes balances, so this one is always by hand.`,
      href: '/points',
      actionLabel: 'Update balances',
    });
  }

  const thisYear = Number(now.slice(0, 4));
  if (expenses.length === 0) {
    items.push({
      id: 'no-expenses',
      severity: 'idle',
      title: 'No spending imported yet',
      detail: 'Drop in a statement and bonus progress, annual fees and tax totals all follow from it.',
      href: '/import',
      actionLabel: 'Import statements',
    });
  } else if (!expenses.some((e) => taxYearOf(e) === thisYear)) {
    items.push({
      id: 'nothing-this-year',
      severity: 'idle',
      title: `Nothing recorded for ${thisYear}`,
      detail: 'The tax summary for this year is empty.',
      href: '/import',
      actionLabel: 'Import statements',
    });
  }

  const order: Record<Severity, number> = { now: 0, soon: 1, idle: 2 };
  return items.sort((a, b) => order[a.severity] - order[b.severity]);
}
