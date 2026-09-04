import { describe, expect, it } from 'vitest';
import {
  detectColumns,
  normalizeDate,
  parseAmountCents,
  parseCsv,
  summarizeSpend,
  toTransactions,
} from '@/lib/csv';

const CHASE = `Transaction Date,Post Date,Description,Category,Type,Amount,Memo
01/15/2024,01/16/2024,WHOLE FOODS,Groceries,Sale,-142.30,
01/20/2024,01/21/2024,"AIRLINE, INC",Travel,Sale,-1250.00,
01/25/2024,01/26/2024,Payment Thank You,,Payment,500.00,
02/02/2024,02/03/2024,WHOLE FOODS,Groceries,Return,42.30,
`;

const DISCOVER = `Trans. Date,Post Date,Description,Amount,Category
01/15/2024,01/16/2024,GAS STATION,45.10,Gasoline
01/18/2024,01/19/2024,INTERNET PAYMENT - THANK YOU,-300.00,Payments and Credits
`;

const CAPITAL_ONE = `Transaction Date,Posted Date,Card No.,Description,Category,Debit,Credit
2024-01-15,2024-01-16,1234,HARDWARE STORE,Merchandise,88.50,
2024-01-22,2024-01-23,1234,REFUND HARDWARE,Merchandise,,20.00
`;

describe('parseCsv', () => {
  it('keeps a comma inside a quoted field', () => {
    const rows = parseCsv('a,b\n"one, two",three\n');
    expect(rows[1]).toEqual(['one, two', 'three']);
  });

  it('unescapes a doubled quote', () => {
    expect(parseCsv('a\n"say ""hi"""\n')[1]).toEqual(['say "hi"']);
  });

  it('handles CRLF and drops blank lines', () => {
    const rows = parseCsv('a,b\r\n1,2\r\n\r\n3,4\r\n');
    expect(rows).toEqual([['a', 'b'], ['1', '2'], ['3', '4']]);
  });

  it('strips a BOM so the first header is still matchable', () => {
    expect(parseCsv('﻿Date,Amount\n')[0][0]).toBe('Date');
  });
});

describe('normalizeDate', () => {
  it('reads the US format issuers export', () => {
    expect(normalizeDate('01/15/2024')).toBe('2024-01-15');
    expect(normalizeDate('1/5/24')).toBe('2024-01-05');
  });

  it('passes ISO through', () => {
    expect(normalizeDate('2024-01-15')).toBe('2024-01-15');
  });

  it('rejects junk', () => {
    expect(normalizeDate('not a date')).toBeNull();
    expect(normalizeDate('13/45/2024')).toBeNull();
  });
});

describe('parseAmountCents', () => {
  it('reads the shapes that appear in exports', () => {
    expect(parseAmountCents('-142.30')).toBe(-14_230);
    expect(parseAmountCents('$1,250.00')).toBe(125_000);
    expect(parseAmountCents('(45.10)')).toBe(-4_510);
    expect(parseAmountCents('')).toBeNull();
    expect(parseAmountCents('n/a')).toBeNull();
  });
});

describe('detectColumns', () => {
  it('prefers the transaction date over the post date', () => {
    const mapping = detectColumns(parseCsv(CHASE));
    expect(mapping?.dateIndex).toBe(0);
  });

  it('infers that Chase writes purchases as negative', () => {
    expect(detectColumns(parseCsv(CHASE))?.purchasesArePositive).toBe(false);
  });

  it('infers that Discover writes purchases as positive', () => {
    expect(detectColumns(parseCsv(DISCOVER))?.purchasesArePositive).toBe(true);
  });

  it('finds a debit/credit pair instead of a signed amount', () => {
    const mapping = detectColumns(parseCsv(CAPITAL_ONE));
    expect(mapping?.debitIndex).toBe(5);
    expect(mapping?.creditIndex).toBe(6);
    expect(mapping?.amountIndex).toBe(-1);
  });

  it('gives up on a file with no usable header', () => {
    expect(detectColumns(parseCsv('foo,bar\n1,2\n'))).toBeNull();
  });
});

describe('toTransactions', () => {
  it('orients Chase amounts so purchases are positive and names the payment', () => {
    const rows = parseCsv(CHASE);
    const txs = toTransactions(rows, detectColumns(rows)!);
    expect(txs.map((t) => [t.kind, t.cents])).toEqual([
      ['purchase', 14_230],
      ['purchase', 125_000],
      ['payment', -50_000],
      ['refund', -4_230],
    ]);
  });

  it('reads a payment out of a Discover row with no type column', () => {
    const rows = parseCsv(DISCOVER);
    const txs = toTransactions(rows, detectColumns(rows)!);
    expect(txs.map((t) => t.kind)).toEqual(['purchase', 'payment']);
  });

  it('reads a Capital One credit column as a refund', () => {
    const rows = parseCsv(CAPITAL_ONE);
    const txs = toTransactions(rows, detectColumns(rows)!);
    expect(txs.map((t) => [t.kind, t.cents])).toEqual([
      ['purchase', 8_850],
      ['refund', -2_000],
    ]);
  });
});

describe('summarizeSpend', () => {
  const rows = parseCsv(CHASE);
  const txs = toTransactions(rows, detectColumns(rows)!);

  it('subtracts refunds, the way an issuer counts', () => {
    const summary = summarizeSpend(txs, '2024-01-01', '2024-04-01');
    expect(summary.purchaseCents).toBe(139_230);
    expect(summary.refundCents).toBe(4_230);
    expect(summary.qualifyingCents).toBe(135_000);
    expect(summary.ignoredCount).toBe(1);
  });

  it('can be told to leave refunds out of it', () => {
    const summary = summarizeSpend(txs, '2024-01-01', '2024-04-01', {
      subtractRefunds: false,
    });
    expect(summary.qualifyingCents).toBe(139_230);
  });

  it('drops rows outside the bonus window', () => {
    const summary = summarizeSpend(txs, '2024-01-01', '2024-01-31');
    expect(summary.qualifyingCents).toBe(139_230);
    expect(summary.outsideWindowCount).toBe(1);
  });

  it('counts a transaction on the deadline itself', () => {
    const summary = summarizeSpend(txs, '2024-01-20', '2024-01-20');
    expect(summary.purchaseCount).toBe(1);
    expect(summary.qualifyingCents).toBe(125_000);
  });

  it('reports the range it actually found', () => {
    const summary = summarizeSpend(txs, '2024-01-01', '2024-04-01');
    expect(summary.firstDate).toBe('2024-01-15');
    expect(summary.lastDate).toBe('2024-02-02');
  });
});

describe('purchase-sign inference', () => {
  it('trusts a Type column over the row counts', () => {
    // Two purchases and two credits: the counts tie, and only the "Sale" rows
    // say which sign a purchase is.
    const tied = `Date,Description,Type,Amount
01/15/2024,STORE,Sale,-10.00
01/16/2024,STORE,Sale,-20.00
01/17/2024,PAYMENT,Payment,100.00
01/18/2024,REFUND,Return,5.00
`;
    expect(detectColumns(parseCsv(tied))?.purchasesArePositive).toBe(false);
  });

  it('falls back to the majority sign when there is no Type column', () => {
    const noType = `Date,Description,Amount
01/15/2024,STORE,-10.00
01/16/2024,STORE,-20.00
01/17/2024,STORE,-30.00
01/18/2024,PAYMENT,100.00
`;
    expect(detectColumns(parseCsv(noType))?.purchasesArePositive).toBe(false);
  });
});
