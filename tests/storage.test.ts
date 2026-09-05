import { describe, expect, it } from 'vitest';
import { coerceData, importJson } from '@/lib/storage';
import { emptyData } from '@/lib/types';

describe('coerceData', () => {
  it('returns an empty store for junk', () => {
    expect(coerceData(null).cards).toEqual([]);
    expect(coerceData('nope').cards).toEqual([]);
    expect(coerceData(42).cards).toEqual([]);
  });

  it('fills in every missing field on a partial card', () => {
    const data = coerceData({ cards: [{ productName: 'Sapphire' }] });
    const card = data.cards[0];
    expect(card.productName).toBe('Sapphire');
    expect(card.id).toBeTruthy();
    expect(card.issuer).toBe('other');
    expect(card.annualFeeCents).toBe(0);
    expect(card.feeHistory).toEqual([]);
    expect(card.bonus).toBeNull();
  });

  it('drops entries that are not objects at all', () => {
    expect(coerceData({ cards: ['nope', null, { productName: 'ok' }] }).cards).toHaveLength(1);
  });

  it('rejects an invalid date rather than storing it', () => {
    const card = coerceData({ cards: [{ openedDate: '2024-02-30' }] }).cards[0];
    // Falls back to today rather than a date that does not exist.
    expect(card.openedDate).not.toBe('2024-02-30');
    expect(card.openedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('clamps a negative fee to zero', () => {
    expect(coerceData({ cards: [{ annualFeeCents: -500 }] }).cards[0].annualFeeCents).toBe(0);
  });

  it('marks a card closed when it carries a closed date', () => {
    const card = coerceData({ cards: [{ closedDate: '2024-01-01' }] }).cards[0];
    expect(card.status).toBe('closed');
  });

  it('keeps one balance per program', () => {
    const data = coerceData({
      cards: [],
      balances: [
        { programId: 'chase-ur', amount: 100, updated: '2024-01-01' },
        { programId: 'chase-ur', amount: 200, updated: '2024-02-01' },
      ],
    });
    expect(data.balances).toHaveLength(1);
    expect(data.balances[0].amount).toBe(100);
  });

  it('throws out a non-numeric valuation override', () => {
    const data = coerceData({
      cards: [],
      valuationOverrides: { 'chase-ur:transfer': 2.1, 'chase-ur:cash': 'free' },
    });
    expect(data.valuationOverrides).toEqual({ 'chase-ur:transfer': 2.1 });
  });

  it('keeps settings inside sane bounds', () => {
    const data = coerceData({ cards: [], settings: { feeReviewLeadDays: -3, theme: 'neon' } });
    expect(data.settings.feeReviewLeadDays).toBe(1);
    // An unrecognised theme falls back to the default, which is dark -- the
    // palette is built around a near-black ground, and light is the alternate.
    expect(data.settings.theme).toBe('dark');
  });

  it('keeps a valid theme choice', () => {
    expect(coerceData({ cards: [], settings: { theme: 'light' } }).settings.theme).toBe('light');
    expect(coerceData({ cards: [], settings: { theme: 'system' } }).settings.theme).toBe('system');
  });

  it('survives a round trip', () => {
    const original = emptyData();
    expect(coerceData(JSON.parse(JSON.stringify(original)))).toMatchObject({
      cards: [],
      balances: [],
    });
  });
});

describe('importJson', () => {
  it('rejects text that is not JSON', () => {
    const result = importJson('{oh no');
    expect(result.ok).toBe(false);
  });

  it('rejects JSON that is not an export', () => {
    const result = importJson('{"hello":"world"}');
    expect(result.ok).toBe(false);
  });

  it('accepts a real export and reports the card count', () => {
    const result = importJson(JSON.stringify({ cards: [{ productName: 'A' }, { productName: 'B' }] }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.cardCount).toBe(2);
  });
});
