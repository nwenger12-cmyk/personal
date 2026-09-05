import { UNCATEGORIZED_ID, getCategory } from './categories';
import { matchRule } from './categorize';
import { detectColumns, parseCsv, toTransactions } from './csv';
import type { ColumnMapping, Transaction } from './csv';
import { bonusDeadline } from './bonuses';
import { toUtcMs } from './dates';
import type { IsoDate } from './dates';
import { createImportKeyer } from './expenses';
import { cardLabel, feeOutlook } from './fees';
import { newId } from './storage';
import type { ParsedStatement, Reconciliation } from './statement-pdf';
import type {
  CardAccount,
  CategorizationRule,
  Expense,
  FeeCharge,
} from './types';

/**
 * Turning a pile of downloaded statements into everything the app tracks, in
 * one pass.
 *
 * The point is that a month's maintenance should be "drop in the files". So a
 * single import works out which card each file belongs to, files what the
 * merchant rules recognise, skips what it has already seen, records any annual
 * fee it finds, and lets bonus progress fall out of the transactions rather
 * than being a second thing to update. Nothing is written until the whole plan
 * has been shown.
 */

// ---- file analysis ----------------------------------------------------------

export type IssuerGuess =
  | 'Chase' | 'Capital One' | 'Citi' | 'Discover' | 'American Express' | null;

/**
 * Which issuer wrote a file, from the header alone. Only used to label the
 * file in the UI and to help match it to a card -- the parser itself works off
 * the column shapes, not off this.
 */
export function guessIssuer(header: string[]): IssuerGuess {
  const cols = header.map((h) => h.trim().toLowerCase());
  const has = (name: string) => cols.some((c) => c.includes(name));

  if (has('card no')) return 'Capital One';
  if (has('memo') && has('post date') && has('type')) return 'Chase';
  if (has('trans. date')) return 'Discover';
  if (has('status') && has('debit')) return 'Citi';
  if (has('extended details') || has('appears on your statement as')) {
    return 'American Express';
  }
  return null;
}

export type FileAnalysis = {
  fileId: string;
  name: string;
  error: string | null;
  /** How the file was read, so the UI can explain what it did. */
  format: 'csv' | 'pdf';
  issuer: IssuerGuess;
  mapping: ColumnMapping | null;
  transactions: Transaction[];
  /** Last-4s the file named on its rows, if any. */
  detectedLast4: string[];
  /** Best guess at the card, from the rows or from the filename. */
  suggestedCardId: string | null;
  /** How the guess was made, so the UI can say why. */
  matchedBy: 'row' | 'filename' | null;
  dateRange: [IsoDate, IsoDate] | null;
  purchaseCount: number;
  paymentCount: number;
  /** PDF only: how the parse compared with the totals the statement prints. */
  reconciliation: Reconciliation | null;
  /** Anything the parse wants to flag before you trust it. */
  warnings: string[];
};

/**
 * Issuers put the account's last four in the download filename -- Chase ships
 * `Chase7730_Activity...csv`. Matching on it is how a file lands on the right
 * card without being asked.
 */
function last4FromFilename(name: string, cards: CardAccount[]): string | null {
  const runs = name.match(/\d{4,}/g) ?? [];
  for (const run of runs) {
    // A long run is a date stamp, not an account number.
    const candidates = run.length === 4 ? [run] : [run.slice(-4)];
    for (const candidate of candidates) {
      if (run.length > 6) continue;
      if (cards.some((c) => c.last4 === candidate)) return candidate;
    }
  }
  return null;
}

export function analyzeFile(
  fileId: string,
  name: string,
  text: string,
  cards: CardAccount[],
  flipSign = false,
): FileAnalysis {
  const base: FileAnalysis = {
    fileId,
    name,
    error: null,
    format: 'csv',
    issuer: null,
    mapping: null,
    transactions: [],
    detectedLast4: [],
    suggestedCardId: null,
    matchedBy: null,
    dateRange: null,
    purchaseCount: 0,
    paymentCount: 0,
    reconciliation: null,
    warnings: [],
  };

  const rows = parseCsv(text);
  if (rows.length < 2) return { ...base, error: 'No data rows in this file.' };

  const detected = detectColumns(rows);
  if (!detected) {
    return {
      ...base,
      issuer: guessIssuer(rows[0]),
      error:
        'No date and amount columns in the header row. Export it with headers included.',
    };
  }

  const mapping: ColumnMapping = {
    ...detected,
    purchasesArePositive: flipSign
      ? !detected.purchasesArePositive
      : detected.purchasesArePositive,
  };

  const transactions = toTransactions(rows, mapping);
  const detectedLast4 = [...new Set(
    transactions.map((t) => t.last4).filter((v): v is string => v !== null),
  )];

  let suggestedCardId: string | null = null;
  let matchedBy: FileAnalysis['matchedBy'] = null;

  // A last-4 on the rows themselves is the strongest signal. Only trust it
  // when the file names exactly one card -- a combined export covering several
  // accounts has to be assigned by hand.
  if (detectedLast4.length === 1) {
    const card = cards.find((c) => c.last4 === detectedLast4[0]);
    if (card) {
      suggestedCardId = card.id;
      matchedBy = 'row';
    }
  }
  if (!suggestedCardId) {
    const fromName = last4FromFilename(name, cards);
    const card = fromName ? cards.find((c) => c.last4 === fromName) : null;
    if (card) {
      suggestedCardId = card.id;
      matchedBy = 'filename';
    }
  }

  const dates = transactions.map((t) => t.date).sort();

  return {
    ...base,
    issuer: guessIssuer(rows[0]),
    mapping,
    transactions,
    detectedLast4,
    suggestedCardId,
    matchedBy,
    dateRange: dates.length > 0 ? [dates[0], dates[dates.length - 1]] : null,
    purchaseCount: transactions.filter((t) => t.kind !== 'payment').length,
    paymentCount: transactions.filter((t) => t.kind === 'payment').length,
  };
}

// ---- annual fee detection ---------------------------------------------------

const FEE_RE = /\bannual\s+(membership\s+)?fee\b/i;

/**
 * Annual fees found in a statement, so the fee history maintains itself.
 *
 * The description is the reliable signal -- issuers write "ANNUAL MEMBERSHIP
 * FEE" in plain text. An amount match near the anniversary is accepted as a
 * fallback, but only within a statement cycle of the predicted date and only
 * when the amount matches exactly, because a coincidental charge for $95 in
 * the right month would otherwise silently move the next prediction a year.
 */
export function detectFeeCharges(
  card: CardAccount,
  transactions: Transaction[],
  leadDays: number,
): FeeCharge[] {
  if (card.annualFeeCents <= 0) return [];

  const outlook = feeOutlook(card, leadDays);
  const expected = outlook.nextChargeDate;
  const alreadyRecorded = (date: IsoDate) =>
    card.feeHistory.some(
      (charge) => Math.abs(toUtcMs(charge.date) - toUtcMs(date)) <= 45 * 86_400_000,
    );

  const found: FeeCharge[] = [];
  for (const tx of transactions) {
    if (tx.kind !== 'purchase') continue;

    const byDescription = FEE_RE.test(tx.description);
    const byAmount =
      expected !== null &&
      tx.cents === card.annualFeeCents &&
      Math.abs(toUtcMs(tx.date) - toUtcMs(expected)) <= 45 * 86_400_000;

    if (!byDescription && !byAmount) continue;
    if (alreadyRecorded(tx.date)) continue;
    if (found.some((f) => Math.abs(toUtcMs(f.date) - toUtcMs(tx.date)) <= 45 * 86_400_000)) {
      continue;
    }

    found.push({
      id: newId(),
      date: tx.date,
      amountCents: tx.cents,
      refunded: false,
      note: `Detected on import — ${tx.description}`.trim(),
    });
  }
  return found;
}

// ---- the plan ---------------------------------------------------------------

export type BonusMove = {
  cardId: string;
  cardLabel: string;
  fromCents: number;
  toCents: number;
  requiredCents: number;
  /** True when this import finishes the spend requirement. */
  completes: boolean;
};

export type ImportPlan = {
  expenses: Expense[];
  /** Rows skipped because an expense with the same import key already exists. */
  duplicates: number;
  /** Payments to the card: never expenses, and counting them would double up. */
  payments: number;
  autoFiled: number;
  feeCharges: { cardId: string; cardLabel: string; charge: FeeCharge }[];
  bonusMoves: BonusMove[];
  totalCents: number;
  unassignedFiles: string[];
};

export type FileAssignment = {
  fileId: string;
  cardId: string | null;
  entityId: string;
};

export function buildPlan(
  analyses: FileAnalysis[],
  assignments: Record<string, FileAssignment>,
  cards: CardAccount[],
  existing: Expense[],
  rules: CategorizationRule[],
  options: { includeRefunds: boolean; applyRules: boolean; leadDays: number },
): ImportPlan {
  const existingKeys = new Set(
    existing.map((e) => e.importKey).filter((v): v is string => v !== null),
  );
  const seenThisRun = new Set<string>();

  const expenses: Expense[] = [];
  const byCard = new Map<string, Transaction[]>();
  let duplicates = 0;
  let payments = 0;
  let autoFiled = 0;
  const unassignedFiles: string[] = [];

  for (const analysis of analyses) {
    if (analysis.error) continue;
    const assignment = assignments[analysis.fileId];
    if (!assignment) continue;
    if (!assignment.cardId) unassignedFiles.push(analysis.name);

    /*
     * Occurrence numbering resets per file, and that boundary is the whole
     * trick. Inside one statement, two identical same-day rows are two real
     * charges and must both import. Across two statements that overlap, the
     * same row appearing in both is one charge -- and because each file
     * numbers from scratch, the second file regenerates the same keys and
     * they dedupe. Numbering across the whole run would break the second
     * case; not numbering at all breaks the first.
     */
    const keyFor = createImportKeyer();

    for (const tx of analysis.transactions) {
      if (tx.kind === 'payment') {
        payments += 1;
        continue;
      }
      if (tx.kind === 'refund' && !options.includeRefunds) continue;

      if (assignment.cardId) {
        const list = byCard.get(assignment.cardId);
        if (list) list.push(tx);
        else byCard.set(assignment.cardId, [tx]);
      }

      const merchant = tx.description || 'Imported transaction';
      const importKey = keyFor(tx.date, tx.cents, merchant);
      // Two files covering an overlapping period will both carry the same
      // row, so this run has to dedupe against itself as well as against
      // what is already stored.
      if (existingKeys.has(importKey) || seenThisRun.has(importKey)) {
        duplicates += 1;
        continue;
      }
      seenThisRun.add(importKey);

      const match = options.applyRules ? matchRule(merchant, '', rules) : null;
      if (match) autoFiled += 1;
      const categoryId = match?.categoryId ?? UNCATEGORIZED_ID;

      expenses.push({
        id: newId(),
        date: tx.date,
        amountCents: tx.cents,
        merchant,
        description: '',
        entityId: match?.entityId ?? assignment.entityId,
        categoryId,
        cardId: assignment.cardId,
        deductiblePercent:
          match?.deductiblePercent ?? getCategory(categoryId)?.defaultDeductiblePercent ?? 100,
        reviewed: false,
        receiptNote: '',
        source: 'import',
        importKey,
        notes: '',
      });
    }
  }

  // Annual fees and bonus movement are both read off the same transactions,
  // which is why they cost nothing extra to keep current.
  const feeCharges: ImportPlan['feeCharges'] = [];
  const bonusMoves: BonusMove[] = [];

  for (const [cardId, transactions] of byCard) {
    const card = cards.find((c) => c.id === cardId);
    if (!card) continue;

    for (const charge of detectFeeCharges(card, transactions, options.leadDays)) {
      feeCharges.push({ cardId, cardLabel: cardLabel(card), charge });
    }

    const bonus = card.bonus;
    if (!bonus || bonus.status !== 'tracking' || bonus.progressSource !== 'expenses') {
      continue;
    }
    const from = toUtcMs(bonus.startDate);
    const to = toUtcMs(bonusDeadline(bonus));
    const before = existing.filter((e) => e.cardId === cardId);
    const after = [...before, ...expenses.filter((e) => e.cardId === cardId)];
    const window = (rows: Expense[]) =>
      rows
        .filter((e) => {
          const ms = toUtcMs(e.date);
          return ms >= from && ms <= to;
        })
        .reduce((sum, e) => sum + e.amountCents, 0);

    const fromCents = Math.max(0, window(before));
    const toCents = Math.max(0, window(after));
    if (toCents === fromCents) continue;

    bonusMoves.push({
      cardId,
      cardLabel: cardLabel(card),
      fromCents,
      toCents,
      requiredCents: bonus.spendRequiredCents,
      completes: fromCents < bonus.spendRequiredCents && toCents >= bonus.spendRequiredCents,
    });
  }

  return {
    expenses,
    duplicates,
    payments,
    autoFiled,
    feeCharges,
    bonusMoves,
    totalCents: expenses.reduce((sum, e) => sum + e.amountCents, 0),
    unassignedFiles,
  };
}

/**
 * The same analysis, for a statement PDF that has already been parsed.
 *
 * It produces the identical FileAnalysis shape as a CSV, which is the point:
 * everything downstream -- card matching, merchant rules, deduplication, bonus
 * progress, annual fee detection -- runs unchanged. A PDF is just another way
 * to arrive at a list of transactions.
 *
 * Two things it knows that a CSV does not: the account number is printed on
 * the statement, so the card match is exact rather than inferred from a
 * filename; and the statement prints its own totals, so the parse arrives with
 * a verdict on whether it added up.
 */
export function analyzeParsedStatement(
  fileId: string,
  name: string,
  parsed: ParsedStatement,
  cards: CardAccount[],
): FileAnalysis {
  const detectedLast4 = parsed.last4 ? [parsed.last4] : [];
  const matched = parsed.last4
    ? cards.find((card) => card.last4 === parsed.last4) ?? null
    : null;

  const dates = parsed.transactions.map((t) => t.date).sort();

  return {
    fileId,
    name,
    error: parsed.transactions.length === 0 && parsed.warnings.length > 0
      ? parsed.warnings[0]
      : null,
    format: 'pdf',
    issuer: parsed.issuer,
    mapping: null,
    transactions: parsed.transactions,
    detectedLast4,
    suggestedCardId: matched?.id ?? null,
    matchedBy: matched ? 'row' : null,
    dateRange: dates.length > 0 ? [dates[0], dates[dates.length - 1]] : null,
    purchaseCount: parsed.transactions.filter((t) => t.kind !== 'payment').length,
    paymentCount: parsed.transactions.filter((t) => t.kind === 'payment').length,
    reconciliation: parsed.reconciliation,
    warnings: parsed.warnings,
  };
}
