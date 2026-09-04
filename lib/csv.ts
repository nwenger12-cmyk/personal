import { isIsoDate, toUtcMs } from './dates';
import type { IsoDate } from './dates';

/**
 * Reading an issuer's transaction export to total bonus spend.
 *
 * This is the closest thing to "connect my accounts" that does not involve
 * handing a third party your bank login. Every issuer lets you download a CSV
 * of a statement period; this parses the four shapes they actually ship:
 *
 *   Chase        Transaction Date, Post Date, Description, Category, Type, Amount
 *                (purchases negative, and a Type column that names payments)
 *   Capital One  Transaction Date, Posted Date, Card No., Description, Debit, Credit
 *                (two columns instead of a sign)
 *   Citi         Status, Date, Description, Debit, Credit
 *   Discover     Trans. Date, Post Date, Description, Amount, Category
 *                (purchases positive -- the opposite of Chase)
 *
 * Nothing is auto-applied. The dialog totals the rows, shows what it included
 * and excluded, and you decide whether the number is right before it lands on
 * the card.
 */

export type CsvRow = string[];

/** RFC 4180-ish: quoted fields, "" escapes, CRLF or LF, embedded newlines. */
export function parseCsv(text: string): CsvRow[] {
  const rows: CsvRow[] = [];
  let row: CsvRow = [];
  let field = '';
  let inQuotes = false;
  // Strip a UTF-8 BOM -- Excel adds one and it corrupts the first header cell.
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];

    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i += 1;
      row.push(field);
      field = '';
      if (row.some((cell) => cell.trim() !== '')) rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }

  row.push(field);
  if (row.some((cell) => cell.trim() !== '')) rows.push(row);
  return rows;
}

/**
 * Dates come out of issuer exports as MM/DD/YYYY, M/D/YY, or already ISO.
 * Two-digit years are read as 2000s -- a credit card statement is not from 1998.
 */
export function normalizeDate(raw: string): IsoDate | null {
  const value = raw.trim();
  if (!value) return null;
  if (isIsoDate(value)) return value;

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(value);
  if (iso) {
    const candidate = `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
    return isIsoDate(candidate) ? candidate : null;
  }

  const us = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/.exec(value);
  if (us) {
    const [, m, d, y] = us;
    const year = y.length === 2 ? `20${y}` : y;
    const candidate = `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    return isIsoDate(candidate) ? candidate : null;
  }

  return null;
}

/** "-$1,234.56", "(1234.56)", "1234.56" -> cents. */
export function parseAmountCents(raw: string): number | null {
  let value = raw.trim();
  if (!value) return null;
  let negative = false;
  if (/^\(.*\)$/.test(value)) {
    negative = true;
    value = value.slice(1, -1);
  }
  value = value.replace(/[$,\s]/g, '');
  if (value.startsWith('-')) {
    negative = true;
    value = value.slice(1);
  }
  if (value.startsWith('+')) value = value.slice(1);
  if (!/^\d*\.?\d*$/.test(value) || value === '' || value === '.') return null;
  const cents = Math.round(Number(value) * 100);
  if (!Number.isFinite(cents)) return null;
  return negative ? -cents : cents;
}

export type ColumnMapping = {
  dateIndex: number;
  /** Single signed amount column; -1 when the file uses debit/credit instead. */
  amountIndex: number;
  debitIndex: number;
  creditIndex: number;
  descriptionIndex: number;
  typeIndex: number;
  /** True when a positive number in the amount column means a purchase. */
  purchasesArePositive: boolean;
};

function findIndex(header: string[], test: (h: string) => boolean): number {
  return header.findIndex((h) => test(h.trim().toLowerCase()));
}

export function detectColumns(rows: CsvRow[]): ColumnMapping | null {
  if (rows.length === 0) return null;
  const header = rows[0];

  // Prefer the transaction date over the posting date: bonus windows are
  // judged on when you spent, and a purchase can post days later.
  let dateIndex = findIndex(header, (h) => /^(trans|transaction)/.test(h) && h.includes('date'));
  if (dateIndex === -1) dateIndex = findIndex(header, (h) => h === 'date');
  if (dateIndex === -1) dateIndex = findIndex(header, (h) => h.includes('date'));
  if (dateIndex === -1) return null;

  const debitIndex = findIndex(header, (h) => h === 'debit' || h.includes('debit'));
  const creditIndex = findIndex(header, (h) => h === 'credit' || h.includes('credit'));
  const amountIndex = findIndex(header, (h) => h === 'amount' || h.includes('amount'));
  if (amountIndex === -1 && debitIndex === -1) return null;

  const descriptionIndex = findIndex(
    header,
    (h) => h.includes('description') || h.includes('merchant') || h.includes('payee'),
  );
  const typeIndex = findIndex(header, (h) => h === 'type' || h === 'status');

  return {
    dateIndex,
    amountIndex: debitIndex === -1 ? amountIndex : -1,
    debitIndex,
    creditIndex,
    descriptionIndex,
    typeIndex,
    purchasesArePositive: debitIndex !== -1
      ? true
      : inferPurchaseSign(rows, amountIndex, typeIndex),
  };
}

/**
 * With one signed Amount column the issuer's sign convention is not in the
 * header, so it has to be inferred. Chase writes purchases negative; Discover
 * and Amex write them positive.
 *
 * A Type column settles it outright -- a row Chase labels "Sale" is a purchase
 * by definition, so its sign is the purchase sign. Without one, purchases
 * outnumber payments on any real statement, so the majority sign wins. A tie
 * only happens on a handful of rows; the import dialog shows which way it read
 * the file and offers a switch to flip it.
 */
const SALE_TYPE_RE = /^(sale|purchase|debit|charge)s?$/i;

function inferPurchaseSign(
  rows: CsvRow[],
  amountIndex: number,
  typeIndex: number,
): boolean {
  let positives = 0;
  let negatives = 0;
  let salePositives = 0;
  let saleNegatives = 0;

  for (let i = 1; i < rows.length; i += 1) {
    const cents = parseAmountCents(rows[i][amountIndex] ?? '');
    if (cents === null || cents === 0) continue;

    if (cents > 0) positives += 1;
    else negatives += 1;

    if (typeIndex !== -1 && SALE_TYPE_RE.test((rows[i][typeIndex] ?? '').trim())) {
      if (cents > 0) salePositives += 1;
      else saleNegatives += 1;
    }
  }

  if (salePositives + saleNegatives > 0) return salePositives >= saleNegatives;
  return positives >= negatives;
}

export type TxKind = 'purchase' | 'refund' | 'payment';

export type Transaction = {
  date: IsoDate;
  description: string;
  /** Oriented so a purchase is always positive, whatever the file's convention. */
  cents: number;
  kind: TxKind;
};

const PAYMENT_RE = /\b(payment|autopay|auto pay|thank you|pymt|e-?payment|bill pay)\b/i;
const REFUND_RE = /\b(refund|return|reversal|credit adjustment|chargeback)\b/i;

function classify(description: string, type: string, oriented: number): TxKind {
  const t = type.trim().toLowerCase();
  if (t === 'payment' || t === 'payments') return 'payment';
  if (t === 'return' || t === 'refund' || t === 'reversal') return 'refund';
  if (oriented >= 0) return 'purchase';
  // A negative row is money coming off the balance: a payment if it reads like
  // one, otherwise a refund, which really does reduce qualifying spend.
  if (PAYMENT_RE.test(description)) return 'payment';
  if (REFUND_RE.test(description)) return 'refund';
  return 'payment';
}

export function toTransactions(rows: CsvRow[], mapping: ColumnMapping): Transaction[] {
  const out: Transaction[] = [];

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    const date = normalizeDate(row[mapping.dateIndex] ?? '');
    if (!date) continue;

    let oriented: number | null = null;
    if (mapping.debitIndex !== -1) {
      const debit = parseAmountCents(row[mapping.debitIndex] ?? '');
      const credit =
        mapping.creditIndex === -1 ? null : parseAmountCents(row[mapping.creditIndex] ?? '');
      if (debit !== null && debit !== 0) oriented = Math.abs(debit);
      else if (credit !== null && credit !== 0) oriented = -Math.abs(credit);
    } else {
      const raw = parseAmountCents(row[mapping.amountIndex] ?? '');
      if (raw !== null) oriented = mapping.purchasesArePositive ? raw : -raw;
    }
    if (oriented === null || oriented === 0) continue;

    const description = (row[mapping.descriptionIndex] ?? '').trim();
    const type = mapping.typeIndex === -1 ? '' : (row[mapping.typeIndex] ?? '');
    out.push({ date, description, cents: oriented, kind: classify(description, type, oriented) });
  }

  return out;
}

export type SpendSummary = {
  /** Purchases minus refunds, which is what an issuer counts. */
  qualifyingCents: number;
  purchaseCents: number;
  refundCents: number;
  purchaseCount: number;
  refundCount: number;
  /** Rows dropped for being outside the bonus window. */
  outsideWindowCount: number;
  /** Payments and other balance credits, never counted toward a bonus. */
  ignoredCount: number;
  firstDate: IsoDate | null;
  lastDate: IsoDate | null;
};

/**
 * Total the spend that falls inside a bonus window. Refunds are subtracted
 * because issuers subtract them -- a returned purchase does not count toward
 * a minimum spend, and people are caught out by that every year.
 */
export function summarizeSpend(
  transactions: Transaction[],
  from: IsoDate,
  to: IsoDate,
  options: { subtractRefunds: boolean } = { subtractRefunds: true },
): SpendSummary {
  const fromMs = toUtcMs(from);
  const toMs = toUtcMs(to);

  let purchaseCents = 0;
  let refundCents = 0;
  let purchaseCount = 0;
  let refundCount = 0;
  let outsideWindowCount = 0;
  let ignoredCount = 0;
  let firstDate: IsoDate | null = null;
  let lastDate: IsoDate | null = null;

  for (const tx of transactions) {
    if (tx.kind === 'payment') {
      ignoredCount += 1;
      continue;
    }
    const ms = toUtcMs(tx.date);
    if (ms < fromMs || ms > toMs) {
      outsideWindowCount += 1;
      continue;
    }
    if (!firstDate || tx.date < firstDate) firstDate = tx.date;
    if (!lastDate || tx.date > lastDate) lastDate = tx.date;

    if (tx.kind === 'purchase') {
      purchaseCents += tx.cents;
      purchaseCount += 1;
    } else {
      refundCents += Math.abs(tx.cents);
      refundCount += 1;
    }
  }

  return {
    qualifyingCents: options.subtractRefunds ? purchaseCents - refundCents : purchaseCents,
    purchaseCents,
    refundCents,
    purchaseCount,
    refundCount,
    outsideWindowCount,
    ignoredCount,
    firstDate,
    lastDate,
  };
}
