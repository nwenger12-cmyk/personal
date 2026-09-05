import { describe, expect, it } from 'vitest';
import { analyzeFile, buildPlan, detectFeeCharges, guessIssuer } from '@/lib/import';
import type { FileAnalysis } from '@/lib/import';
import { parseCsv, toTransactions, detectColumns } from '@/lib/csv';
import { blankBonus, blankCard, newId } from '@/lib/storage';
import type { CardAccount, Expense } from '@/lib/types';

const CHASE = `Transaction Date,Post Date,Description,Category,Type,Amount,Memo
01/15/2024,01/16/2024,ADOBE CREATIVE CLOUD,Software,Sale,-69.99,
01/20/2024,01/21/2024,B&H PHOTO VIDEO,Shopping,Sale,-1250.00,
01/25/2024,01/26/2024,Payment Thank You,,Payment,500.00,
`;

const CAPITAL_ONE = `Transaction Date,Posted Date,Card No.,Description,Category,Debit,Credit
2024-01-15,2024-01-16,3308,HARDWARE STORE,Merchandise,88.50,
2024-01-22,2024-01-23,3308,LENSRENTALS.COM,Merchandise,300.00,
`;

function card(overrides: Partial<CardAccount> = {}): CardAccount {
  return { ...blankCard('2023-01-10'), id: 'card-1', productName: 'Test', ...overrides };
}

function expense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: newId(),
    date: '2024-01-10',
    amountCents: 10_000,
    merchant: 'SOMETHING',
    description: '',
    entityId: 'biz',
    categoryId: 'supplies',
    cardId: 'card-1',
    deductiblePercent: 100,
    reviewed: true,
    receiptNote: '',
    source: 'import',
    importKey: null,
    notes: '',
    ...overrides,
  };
}

describe('guessIssuer', () => {
  it('recognises the shapes the big issuers export', () => {
    expect(guessIssuer(parseCsv(CHASE)[0])).toBe('Chase');
    expect(guessIssuer(parseCsv(CAPITAL_ONE)[0])).toBe('Capital One');
    expect(guessIssuer(['Trans. Date', 'Post Date', 'Description', 'Amount'])).toBe('Discover');
    expect(guessIssuer(['Status', 'Date', 'Description', 'Debit', 'Credit'])).toBe('Citi');
  });

  it('returns null rather than guessing at an unknown shape', () => {
    expect(guessIssuer(['Date', 'Amount'])).toBeNull();
  });
});

describe('analyzeFile', () => {
  const cards = [
    card({ id: 'chase-card', last4: '7730' }),
    card({ id: 'c1-card', last4: '3308' }),
  ];

  it('matches a card from a last-4 on the rows', () => {
    const a = analyzeFile('f1', 'export.csv', CAPITAL_ONE, cards);
    expect(a.detectedLast4).toEqual(['3308']);
    expect(a.suggestedCardId).toBe('c1-card');
    expect(a.matchedBy).toBe('row');
  });

  it('falls back to the last-4 in the download filename', () => {
    // Chase names its export Chase7730_Activity...csv and puts no card number
    // in the rows, so the filename is the only signal available.
    const a = analyzeFile('f2', 'Chase7730_Activity20240101_20240131.CSV', CHASE, cards);
    expect(a.suggestedCardId).toBe('chase-card');
    expect(a.matchedBy).toBe('filename');
  });

  it('does not read a date stamp in the filename as an account number', () => {
    const a = analyzeFile('f3', 'export_20240131.csv', CHASE, [card({ last4: '0131' })]);
    expect(a.suggestedCardId).toBeNull();
  });

  it('leaves a combined export naming several cards unassigned', () => {
    const multi = CAPITAL_ONE + '2024-01-25,2024-01-26,9999,OTHER CARD,Merchandise,10.00,\n';
    const a = analyzeFile('f4', 'all.csv', multi, [
      ...cards,
      card({ id: 'other', last4: '9999' }),
    ]);
    expect(a.detectedLast4.sort()).toEqual(['3308', '9999']);
    expect(a.suggestedCardId).toBeNull();
  });

  it('counts purchases and payments separately', () => {
    const a = analyzeFile('f5', 'x.csv', CHASE, cards);
    expect(a.purchaseCount).toBe(2);
    expect(a.paymentCount).toBe(1);
    expect(a.dateRange).toEqual(['2024-01-15', '2024-01-25']);
  });

  it('reports a file it cannot read instead of throwing', () => {
    expect(analyzeFile('f6', 'bad.csv', 'nope\n1\n', cards).error).toBeTruthy();
    expect(analyzeFile('f7', 'empty.csv', '', cards).error).toBeTruthy();
  });
});

describe('detectFeeCharges', () => {
  const feeCard = card({ openedDate: '2023-06-10', annualFeeCents: 9_500 });
  const txs = (csv: string) => {
    const rows = parseCsv(csv);
    return toTransactions(rows, detectColumns(rows)!);
  };

  it('finds a fee by its description', () => {
    const found = detectFeeCharges(
      feeCard,
      txs(`Date,Description,Type,Amount\n06/12/2024,ANNUAL MEMBERSHIP FEE,Sale,-95.00\n`),
      45,
    );
    expect(found).toHaveLength(1);
    expect(found[0].date).toBe('2024-06-12');
    expect(found[0].amountCents).toBe(9_500);
  });

  it('ignores an ordinary purchase for the same amount', () => {
    const found = detectFeeCharges(
      feeCard,
      txs(`Date,Description,Type,Amount\n03/02/2024,RANDOM STORE,Sale,-95.00\n`),
      45,
    );
    expect(found).toHaveLength(0);
  });

  it('does not re-record a fee already in the history', () => {
    const withHistory = {
      ...feeCard,
      feeHistory: [
        { id: 'f1', date: '2024-06-10', amountCents: 9_500, refunded: false, note: '' },
      ],
    };
    const found = detectFeeCharges(
      withHistory,
      txs(`Date,Description,Type,Amount\n06/12/2024,ANNUAL MEMBERSHIP FEE,Sale,-95.00\n`),
      45,
    );
    expect(found).toHaveLength(0);
  });

  it('records only one fee per cycle when a file repeats it', () => {
    const found = detectFeeCharges(
      feeCard,
      txs(
        `Date,Description,Type,Amount\n` +
          `06/12/2024,ANNUAL MEMBERSHIP FEE,Sale,-95.00\n` +
          `06/13/2024,ANNUAL MEMBERSHIP FEE,Sale,-95.00\n`,
      ),
      45,
    );
    expect(found).toHaveLength(1);
  });

  it('finds nothing on a no-fee card', () => {
    const found = detectFeeCharges(
      card({ annualFeeCents: 0 }),
      txs(`Date,Description,Type,Amount\n06/12/2024,ANNUAL MEMBERSHIP FEE,Sale,-95.00\n`),
      45,
    );
    expect(found).toHaveLength(0);
  });
});

describe('buildPlan', () => {
  const cards = [card({ id: 'chase-card', last4: '7730' })];
  const opts = { includeRefunds: true, applyRules: true, leadDays: 45 };

  function analysisFor(csv: string, name = 'x.csv'): FileAnalysis {
    return analyzeFile('f1', name, csv, cards);
  }

  const assign = { f1: { fileId: 'f1', cardId: 'chase-card', entityId: 'biz' } };

  it('turns purchases into expenses and drops payments', () => {
    const plan = buildPlan([analysisFor(CHASE)], assign, cards, [], [], opts);
    expect(plan.expenses).toHaveLength(2);
    expect(plan.payments).toBe(1);
    expect(plan.totalCents).toBe(6_999 + 125_000);
  });

  it('files what the merchant rules recognise', () => {
    const plan = buildPlan([analysisFor(CHASE)], assign, cards, [], [], opts);
    expect(plan.autoFiled).toBe(2);
    expect(plan.expenses.map((e) => e.categoryId).sort()).toEqual(['software', 'supplies']);
  });

  it('leaves everything unreviewed even when a rule filed it', () => {
    const plan = buildPlan([analysisFor(CHASE)], assign, cards, [], [], opts);
    expect(plan.expenses.every((e) => !e.reviewed)).toBe(true);
  });

  it('skips rows already stored', () => {
    const first = buildPlan([analysisFor(CHASE)], assign, cards, [], [], opts);
    const second = buildPlan([analysisFor(CHASE)], assign, cards, first.expenses, [], opts);
    expect(second.expenses).toHaveLength(0);
    expect(second.duplicates).toBe(2);
  });

  it('dedupes two overlapping files against each other in one run', () => {
    // Two statements covering an overlapping period both carry the same row.
    const a = analyzeFile('f1', 'jan.csv', CHASE, cards);
    const b = analyzeFile('f2', 'feb.csv', CHASE, cards);
    const plan = buildPlan(
      [a, b],
      {
        f1: { fileId: 'f1', cardId: 'chase-card', entityId: 'biz' },
        f2: { fileId: 'f2', cardId: 'chase-card', entityId: 'biz' },
      },
      cards,
      [],
      [],
      opts,
    );
    expect(plan.expenses).toHaveLength(2);
    expect(plan.duplicates).toBe(2);
  });

  it('names files it could not assign to a card', () => {
    const plan = buildPlan(
      [analysisFor(CHASE, 'mystery.csv')],
      { f1: { fileId: 'f1', cardId: null, entityId: 'biz' } },
      cards,
      [],
      [],
      opts,
    );
    expect(plan.unassignedFiles).toEqual(['mystery.csv']);
    expect(plan.expenses.every((e) => e.cardId === null)).toBe(true);
  });

  it('moves a derived bonus forward by the imported spend', () => {
    const withBonus = card({ id: 'chase-card', last4: '7730', openedDate: '2024-01-01' });
    withBonus.bonus = {
      ...blankBonus(withBonus),
      spendRequiredCents: 100_000,
      spendWindowMonths: 3,
      startDate: '2024-01-01',
      progressSource: 'expenses',
      status: 'tracking',
    };
    const plan = buildPlan(
      [analyzeFile('f1', 'x.csv', CHASE, [withBonus])],
      assign,
      [withBonus],
      [],
      [],
      opts,
    );
    expect(plan.bonusMoves).toHaveLength(1);
    expect(plan.bonusMoves[0].fromCents).toBe(0);
    expect(plan.bonusMoves[0].toCents).toBe(6_999 + 125_000);
    expect(plan.bonusMoves[0].completes).toBe(true);
  });

  it('leaves a manually-tracked bonus alone', () => {
    const withBonus = card({ id: 'chase-card', last4: '7730', openedDate: '2024-01-01' });
    withBonus.bonus = {
      ...blankBonus(withBonus),
      spendRequiredCents: 100_000,
      startDate: '2024-01-01',
      progressSource: 'manual',
      status: 'tracking',
    };
    const plan = buildPlan(
      [analyzeFile('f1', 'x.csv', CHASE, [withBonus])],
      assign,
      [withBonus],
      [],
      [],
      opts,
    );
    expect(plan.bonusMoves).toHaveLength(0);
  });

  it('counts spend already stored in the from-figure', () => {
    const withBonus = card({ id: 'chase-card', last4: '7730', openedDate: '2024-01-01' });
    withBonus.bonus = {
      ...blankBonus(withBonus),
      spendRequiredCents: 500_000,
      startDate: '2024-01-01',
      progressSource: 'expenses',
      status: 'tracking',
    };
    const existing = [expense({ date: '2024-01-05', amountCents: 20_000, cardId: 'chase-card' })];
    const plan = buildPlan(
      [analyzeFile('f1', 'x.csv', CHASE, [withBonus])],
      assign,
      [withBonus],
      existing,
      [],
      opts,
    );
    expect(plan.bonusMoves[0].fromCents).toBe(20_000);
    expect(plan.bonusMoves[0].toCents).toBe(20_000 + 6_999 + 125_000);
    expect(plan.bonusMoves[0].completes).toBe(false);
  });

  it('picks up an annual fee out of the same file', () => {
    const feeCard = card({
      id: 'chase-card',
      last4: '7730',
      openedDate: '2023-06-10',
      annualFeeCents: 9_500,
    });
    const csv =
      `Transaction Date,Post Date,Description,Category,Type,Amount,Memo\n` +
      `06/12/2024,06/13/2024,ANNUAL MEMBERSHIP FEE,Fees,Sale,-95.00,\n`;
    const plan = buildPlan(
      [analyzeFile('f1', 'x.csv', csv, [feeCard])],
      assign,
      [feeCard],
      [],
      [],
      opts,
    );
    expect(plan.feeCharges).toHaveLength(1);
    expect(plan.feeCharges[0].charge.amountCents).toBe(9_500);
  });

  it('can be told to leave refunds out', () => {
    const csv =
      `Transaction Date,Post Date,Description,Category,Type,Amount,Memo\n` +
      `01/15/2024,01/16/2024,STORE,Shopping,Sale,-100.00,\n` +
      `01/20/2024,01/21/2024,STORE REFUND,Shopping,Return,25.00,\n`;
    const withRefunds = buildPlan([analyzeFile('f1', 'x.csv', csv, cards)], assign, cards, [], [], opts);
    expect(withRefunds.expenses).toHaveLength(2);
    const without = buildPlan([analyzeFile('f1', 'x.csv', csv, cards)], assign, cards, [], [], {
      ...opts,
      includeRefunds: false,
    });
    expect(without.expenses).toHaveLength(1);
  });
});
