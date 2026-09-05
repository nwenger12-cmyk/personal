import { describe, expect, it } from 'vitest';
import {
  findLast4,
  findPeriod,
  findStatedTotals,
  guessPdfIssuer,
  parseStatementLines,
  resolveYear,
} from '@/lib/statement-pdf';
import { CHASE_STATEMENT_LINES, JANUARY_STATEMENT_LINES } from './fixtures/chase-statement';

describe('findPeriod', () => {
  it('reads an opening/closing range', () => {
    expect(findPeriod(CHASE_STATEMENT_LINES)).toEqual({
      start: '2026-07-29',
      end: '2026-08-28',
    });
  });

  it('falls back to a statement date', () => {
    expect(findPeriod(['NATHAN W Page 2 of 2 Statement Date: 08/28/26']).end).toBe('2026-08-28');
  });

  it('reports nothing rather than guessing', () => {
    expect(findPeriod(['no dates here'])).toEqual({ start: null, end: null });
  });
});

describe('findLast4', () => {
  it('pulls the last four from a masked account number', () => {
    expect(findLast4(CHASE_STATEMENT_LINES)).toBe('4321');
    expect(findLast4(['Account Number: XXXX XXXX XXXX 1659'])).toBe('1659');
    expect(findLast4(['Account number: ****-****-****-9021'])).toBe('9021');
  });

  it('ignores prose that merely mentions an account number', () => {
    expect(findLast4(['write your account number on your check'])).toBeNull();
  });
});

describe('guessPdfIssuer', () => {
  it('recognises the issuer from the statement chrome', () => {
    expect(guessPdfIssuer(CHASE_STATEMENT_LINES)).toBe('Chase');
    expect(guessPdfIssuer(['visit capitalone.com'])).toBe('Capital One');
    expect(guessPdfIssuer(['your Cashback Bonus'])).toBe('Discover');
    expect(guessPdfIssuer(['nothing familiar'])).toBeNull();
  });
});

describe('resolveYear', () => {
  it('uses the closing year for a month at or before closing', () => {
    expect(resolveYear(8, '2026-08-28')).toBe(2026);
    expect(resolveYear(7, '2026-08-28')).toBe(2026);
  });

  it('rolls back a month after the closing month', () => {
    // A 12/28 row on a statement closing 01/15/27 is from 2026 -- getting this
    // wrong puts every December purchase in the wrong tax year.
    expect(resolveYear(12, '2027-01-15')).toBe(2026);
  });
});

describe('findStatedTotals', () => {
  it('reads the summary block', () => {
    const totals = findStatedTotals(CHASE_STATEMENT_LINES);
    expect(totals.purchasesCents).toBe(16_259);
    expect(totals.creditsCents).toBe(5_000);
    expect(totals.feesCents).toBe(0);
  });
});

describe('parseStatementLines', () => {
  const parsed = parseStatementLines(CHASE_STATEMENT_LINES);

  it('finds every transaction row', () => {
    expect(parsed.transactions).toHaveLength(7);
  });

  it('dates rows from the closing year', () => {
    expect(parsed.transactions[0].date).toBe('2026-08-25');
    expect(parsed.transactions.every((t) => t.date.startsWith('2026-08'))).toBe(true);
  });

  it('takes the sign from the section heading, not the printed number', () => {
    // Chase prints purchases positive here and negative in its CSV export. The
    // heading is the only signal that means the same thing in both.
    const purchases = parsed.transactions.filter((t) => t.kind === 'purchase');
    expect(purchases).toHaveLength(5);
    expect(purchases.every((t) => t.cents > 0)).toBe(true);
  });

  it('separates a payment from a refund inside the credits section', () => {
    const payment = parsed.transactions.find((t) => t.description.includes('AUTOMATIC PAYMENT'));
    const refund = parsed.transactions.find((t) => t.description.includes('STORE REFUND'));
    expect(payment?.kind).toBe('payment');
    expect(refund?.kind).toBe('refund');
    expect(payment?.cents).toBe(-3_000);
    expect(refund?.cents).toBe(-2_000);
  });

  it('keeps the merchant text without the amount', () => {
    const row = parsed.transactions.find((t) => t.description.startsWith('CORNER MARKET'));
    expect(row?.description).toBe('CORNER MARKET 0033 508-270-1400 PA');
    expect(row?.cents).toBe(4_561);
  });

  it('tags every row with the account it came from', () => {
    expect(parsed.transactions.every((t) => t.last4 === '4321')).toBe(true);
  });

  it('reconciles against the totals the statement prints', () => {
    expect(parsed.reconciliation?.parsedPurchasesCents).toBe(16_259);
    expect(parsed.reconciliation?.statedPurchasesCents).toBe(16_259);
    expect(parsed.reconciliation?.purchasesMatch).toBe(true);
    expect(parsed.reconciliation?.creditsMatch).toBe(true);
    expect(parsed.warnings).toEqual([]);
  });

  it('warns when the parse does not add up', () => {
    // Drop a row and the totals must stop agreeing -- this is the whole point
    // of checking against the statement rather than trusting the parse.
    const missing = CHASE_STATEMENT_LINES.filter(
      (l) => !l.includes('HARDWARE SUPPLY'),
    );
    const result = parseStatementLines(missing);
    expect(result.transactions).toHaveLength(6);
    expect(result.reconciliation?.purchasesMatch).toBe(false);
    expect(result.warnings.join(' ')).toContain('rows were probably missed');
  });

  it('stops at the year-to-date summary', () => {
    // The interest table below it is full of numbers that would otherwise
    // parse as transactions.
    expect(parsed.transactions.some((t) => t.description.includes('APR'))).toBe(false);
    expect(parsed.transactions.some((t) => t.description.includes('Billing Period'))).toBe(false);
  });

  it('handles a statement that straddles the new year', () => {
    const january = parseStatementLines(JANUARY_STATEMENT_LINES);
    expect(january.transactions.map((t) => t.date)).toEqual(['2026-12-28', '2027-01-04']);
  });

  it('gives up cleanly with no closing date', () => {
    const result = parseStatementLines(['PURCHASE', '08/05 SOMETHING 10.00']);
    expect(result.transactions).toEqual([]);
    expect(result.warnings.join(' ')).toContain('closing date');
  });

  it('reports a scanned statement with no selectable text', () => {
    const result = parseStatementLines(['Opening/Closing Date 07/29/26 - 08/28/26']);
    expect(result.transactions).toEqual([]);
    expect(result.warnings.join(' ')).toContain('scanned PDF');
  });

  it('reads a row that carries both a transaction and a posting date', () => {
    const result = parseStatementLines([
      'Opening/Closing Date 07/29/26 - 08/28/26',
      'PURCHASE',
      '08/05 08/06 SOME MERCHANT CITY ST 25.00',
    ]);
    expect(result.transactions[0].date).toBe('2026-08-05');
    expect(result.transactions[0].description).toBe('SOME MERCHANT CITY ST');
    expect(result.transactions[0].cents).toBe(2_500);
  });
});

describe('credit classification', () => {
  const parse = (rows: string[]) =>
    parseStatementLines([
      'Opening/Closing Date 07/29/26 - 08/28/26',
      'PAYMENTS AND OTHER CREDITS',
      ...rows,
    ]).transactions;

  it('reads a merchant credit as a refund even when it says "thank you"', () => {
    // Chase writes "THANK YOU" on both payments and promo credits. Calling a
    // credit a payment would drop it, overstating spend toward a bonus.
    expect(parse(['08/20 $10 PROMO CREDIT THANK YOU AZ -10.00'])[0].kind).toBe('refund');
    expect(parse(['08/20 STORE RETURN THANK YOU -25.00'])[0].kind).toBe('refund');
  });

  it('still reads an actual payment as a payment', () => {
    expect(parse(['08/25 AUTOMATIC PAYMENT - THANK YOU -7.41'])[0].kind).toBe('payment');
    expect(parse(['08/25 ONLINE PAYMENT THANK YOU -50.00'])[0].kind).toBe('payment');
  });

  it('defaults an unrecognised credit to a payment rather than to spend', () => {
    // The safer default: a payment is excluded, so an unknown credit cannot
    // silently inflate a bonus total.
    expect(parse(['08/25 SOMETHING UNCLEAR -5.00'])[0].kind).toBe('payment');
  });
});
