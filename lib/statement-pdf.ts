import { isIsoDate } from './dates';
import type { IsoDate } from './dates';
import type { Transaction, TxKind } from './csv';
import type { IssuerGuess } from './import';

/**
 * Reading a PDF statement.
 *
 * A statement is a better source than a CSV export in three ways, and the
 * parser leans on all of them:
 *
 *   1. Section headings ("PURCHASE", "PAYMENTS AND OTHER CREDITS") say what a
 *      row IS. A CSV only has a signed number, and the sign convention differs
 *      by issuer -- Chase writes purchases negative in its export and positive
 *      on the statement it sends you. Headings remove the guess entirely.
 *   2. The account number is printed on it, so the file lands on the right card
 *      without being asked.
 *   3. The statement prints its own totals, so the parse can be CHECKED. If the
 *      purchases we found do not add up to the purchases it claims, rows were
 *      missed, and saying so is far better than importing a wrong subset that
 *      looks fine.
 *
 * The cost is that rows carry MM/DD with no year, so the year comes from the
 * closing date -- and a December row on a January statement belongs to the
 * previous year, which is handled below.
 *
 * This module is deliberately free of pdf.js: it takes lines of text and
 * returns transactions, so it can be tested against a real statement's output
 * without a browser or a PDF engine.
 */

export type SectionKind = 'purchase' | 'credit' | 'fee' | 'interest' | null;

const SECTION_PATTERNS: { pattern: RegExp; kind: SectionKind }[] = [
  { pattern: /^PAYMENTS?\s+AND\s+OTHER\s+CREDITS$/i, kind: 'credit' },
  { pattern: /^(RETURNS?|CREDITS?|PAYMENTS?)(\s+AND\s+CREDITS?)?$/i, kind: 'credit' },
  { pattern: /^PAYMENTS?,?\s+CREDITS?\s+AND\s+ADJUSTMENTS?$/i, kind: 'credit' },
  { pattern: /^PURCHASES?(\s+AND\s+ADJUSTMENTS?)?$/i, kind: 'purchase' },
  { pattern: /^(TRANSACTIONS?|ACCOUNT\s+ACTIVITY)$/i, kind: 'purchase' },
  { pattern: /^FEES?\s+CHARGED$/i, kind: 'fee' },
  { pattern: /^INTEREST\s+CHARGED$/i, kind: 'interest' },
  { pattern: /^CASH\s+ADVANCES?$/i, kind: 'purchase' },
];

/** Lines after one of these are summary tables, not transactions. */
const STOP_PATTERNS = [
  /Totals?\s+Year-to-Date/i,
  /^INTEREST\s+CHARGES$/i,
  /^IMPORTANT\s+NEWS$/i,
  /Your\s+Annual\s+Percentage\s+Rate/i,
];

// A row is: MM/DD, optionally a second MM/DD (posting date), a description,
// then the amount. The description is non-greedy so the trailing number wins.
const ROW = /^(\d{1,2})\/(\d{1,2})(?:\s+(\d{1,2})\/(\d{1,2}))?\s+(.+?)\s+(-?\$?[\d,]+\.\d{2})-?$/;

/**
 * Order matters here, and it is checked refund-first.
 *
 * Chase appends "THANK YOU" to both a payment ("AUTOMATIC PAYMENT - THANK
 * YOU") and a merchant credit ("$10 PROMO CREDIT THANK YOU AZ"), so matching
 * the payment words first labels every credit a payment. An explicit
 * refund/return/credit word is the more specific signal, so it wins; the
 * payment words are the fallback.
 *
 * The distinction is not cosmetic: a payment is dropped entirely, while a
 * refund nets off qualifying spend. Getting it backwards overstates spend
 * toward a sign-up bonus.
 */
const REFUND_RE = /\b(refunds?|returns?|reversals?|credits?|chargebacks?|cash ?back)\b/i;
const PAYMENT_RE = /\b(payment|autopay|auto pay|thank you|pymt|e-?payment|bill pay)\b/i;

function parseMoney(raw: string): number | null {
  let value = raw.trim();
  let negative = value.startsWith('-');
  value = value.replace(/^-/, '').replace(/[$,]/g, '');
  if (!/^\d*\.?\d*$/.test(value) || value === '') return null;
  const cents = Math.round(Number(value) * 100);
  if (!Number.isFinite(cents)) return null;
  return negative ? -cents : cents;
}

/** "07/29/26" or "07/29/2026" -> ISO. Two-digit years are this century. */
function parseSlashDate(raw: string): IsoDate | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(raw.trim());
  if (!m) return null;
  const year = m[3].length === 2 ? `20${m[3]}` : m[3];
  const iso = `${year}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  return isIsoDate(iso) ? iso : null;
}

export type StatementPeriod = { start: IsoDate | null; end: IsoDate | null };

export function findPeriod(lines: string[]): StatementPeriod {
  for (const line of lines) {
    const range = /Opening\s*\/\s*Closing\s+Date\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s*[-–]\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i.exec(line);
    if (range) {
      return { start: parseSlashDate(range[1]), end: parseSlashDate(range[2]) };
    }
  }
  for (const line of lines) {
    const closing = /(?:Statement|Closing)\s+Date:?\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/i.exec(line);
    if (closing) return { start: null, end: parseSlashDate(closing[1]) };
  }
  return { start: null, end: null };
}

export function findLast4(lines: string[]): string | null {
  for (const line of lines) {
    const m = /Account\s+Number:?\s*([\dX* -]{8,})/i.exec(line);
    if (!m) continue;
    const digits = m[1].replace(/\D/g, '');
    if (digits.length >= 4) return digits.slice(-4);
  }
  return null;
}

export function guessPdfIssuer(lines: string[]): IssuerGuess {
  const text = lines.join(' ').toLowerCase();
  if (text.includes('chase.com') || text.includes('ultimate rewards')) return 'Chase';
  if (text.includes('capitalone.com') || text.includes('capital one')) return 'Capital One';
  if (text.includes('citicards') || text.includes('citi.com')) return 'Citi';
  if (text.includes('discover.com') || text.includes('cashback bonus')) return 'Discover';
  if (text.includes('americanexpress.com') || text.includes('membership rewards')) {
    return 'American Express';
  }
  return null;
}

/**
 * The year a MM/DD row belongs to.
 *
 * Rows are dated within the statement period, so a month LATER than the
 * closing month must be from the year before -- a 12/28 row on a statement
 * closing 01/15/27 is from 2026. Without this, every December purchase on a
 * January statement lands in the wrong tax year.
 */
export function resolveYear(month: number, closing: IsoDate): number {
  const closingYear = Number(closing.slice(0, 4));
  const closingMonth = Number(closing.slice(5, 7));
  return month > closingMonth ? closingYear - 1 : closingYear;
}

export type StatedTotals = {
  purchasesCents: number | null;
  creditsCents: number | null;
  feesCents: number | null;
};

export function findStatedTotals(lines: string[]): StatedTotals {
  const totals: StatedTotals = { purchasesCents: null, creditsCents: null, feesCents: null };
  for (const line of lines) {
    const purchases = /^Purchases\s+\+?(-?\$[\d,]+\.\d{2})$/i.exec(line.trim());
    if (purchases) totals.purchasesCents = parseMoney(purchases[1]);

    const credits = /^Payments?,?\s+Credits?\s+(-?\$[\d,]+\.\d{2})$/i.exec(line.trim());
    if (credits) totals.creditsCents = Math.abs(parseMoney(credits[1]) ?? 0);

    const fees = /^Fees?\s+Charged\s+\+?(-?\$[\d,]+\.\d{2})$/i.exec(line.trim());
    if (fees) totals.feesCents = parseMoney(fees[1]);
  }
  return totals;
}

export type Reconciliation = {
  statedPurchasesCents: number;
  parsedPurchasesCents: number;
  statedCreditsCents: number;
  parsedCreditsCents: number;
  purchasesMatch: boolean;
  creditsMatch: boolean;
};

export type ParsedStatement = {
  issuer: IssuerGuess;
  last4: string | null;
  period: StatementPeriod;
  transactions: Transaction[];
  stated: StatedTotals;
  /** null when the statement did not print totals to check against. */
  reconciliation: Reconciliation | null;
  warnings: string[];
};

export function parseStatementLines(lines: string[]): ParsedStatement {
  const warnings: string[] = [];
  const period = findPeriod(lines);
  const last4 = findLast4(lines);
  const issuer = guessPdfIssuer(lines);
  const stated = findStatedTotals(lines);

  const closing = period.end;
  if (!closing) {
    warnings.push(
      'No statement closing date found, so the year on each transaction could not be worked out.',
    );
    return {
      issuer, last4, period, transactions: [], stated, reconciliation: null, warnings,
    };
  }

  const transactions: Transaction[] = [];
  let section: SectionKind = null;
  let stopped = false;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (STOP_PATTERNS.some((p) => p.test(line))) {
      // Only stop once transactions have started; these headings also appear
      // in the marketing blocks before the activity table.
      if (transactions.length > 0) stopped = true;
      continue;
    }
    if (stopped) continue;

    const heading = SECTION_PATTERNS.find((s) => s.pattern.test(line));
    if (heading) {
      section = heading.kind;
      continue;
    }

    const row = ROW.exec(line);
    if (!row) continue;

    const month = Number(row[1]);
    const day = Number(row[2]);
    if (month < 1 || month > 12 || day < 1 || day > 31) continue;

    const amount = parseMoney(row[6]);
    if (amount === null) continue;

    const year = resolveYear(month, closing);
    const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (!isIsoDate(date)) continue;

    const description = row[5].trim();

    // The section heading decides the sign, not the printed one: it is the
    // only signal that means the same thing across issuers.
    const isCredit = section === 'credit';
    const cents = isCredit ? -Math.abs(amount) : Math.abs(amount);

    let kind: TxKind;
    if (!isCredit) kind = 'purchase';
    else if (REFUND_RE.test(description)) kind = 'refund';
    else if (PAYMENT_RE.test(description)) kind = 'payment';
    else kind = 'payment';

    transactions.push({ date, description, cents, kind, last4 });
  }

  if (section === null && transactions.length === 0) {
    warnings.push(
      'No transaction section was found. This may be a summary-only statement, or a scanned PDF with no selectable text.',
    );
  }

  // ---- check the parse against the statement's own totals -------------------
  let reconciliation: Reconciliation | null = null;
  if (stated.purchasesCents !== null || stated.creditsCents !== null) {
    const parsedPurchases = transactions
      .filter((t) => t.cents > 0)
      .reduce((sum, t) => sum + t.cents, 0);
    const parsedCredits = transactions
      .filter((t) => t.cents < 0)
      .reduce((sum, t) => sum + Math.abs(t.cents), 0);

    const statedPurchases = (stated.purchasesCents ?? 0) + (stated.feesCents ?? 0);
    const statedCredits = stated.creditsCents ?? 0;

    reconciliation = {
      statedPurchasesCents: statedPurchases,
      parsedPurchasesCents: parsedPurchases,
      statedCreditsCents: statedCredits,
      parsedCreditsCents: parsedCredits,
      purchasesMatch: stated.purchasesCents === null || parsedPurchases === statedPurchases,
      creditsMatch: stated.creditsCents === null || parsedCredits === statedCredits,
    };

    if (!reconciliation.purchasesMatch) {
      warnings.push(
        `Purchases add up to ${(parsedPurchases / 100).toFixed(2)} but the statement says ` +
          `${(statedPurchases / 100).toFixed(2)}. Some rows were probably missed — check before importing.`,
      );
    }
    if (!reconciliation.creditsMatch) {
      warnings.push(
        `Credits add up to ${(parsedCredits / 100).toFixed(2)} but the statement says ` +
          `${(statedCredits / 100).toFixed(2)}.`,
      );
    }
  } else if (transactions.length > 0) {
    warnings.push(
      'This statement does not print its own totals, so the parse could not be checked against them.',
    );
  }

  return { issuer, last4, period, transactions, stated, reconciliation, warnings };
}
