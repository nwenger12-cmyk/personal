/**
 * Money is stored as integer cents everywhere. Nothing in this app holds a
 * dollar float -- a bonus requirement of $4,000 and a running total of many
 * transactions both have to compare exactly, and 0.1 + 0.2 does not.
 */

const DOLLARS = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const DOLLARS_ROUND = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const PLAIN = new Intl.NumberFormat('en-US');

export function formatCents(cents: number): string {
  return DOLLARS.format(cents / 100);
}

/** Whole dollars, for headline figures where cents are noise. */
export function formatDollars(cents: number): string {
  return DOLLARS_ROUND.format(Math.round(cents / 100));
}

export function formatNumber(value: number): string {
  return PLAIN.format(Math.round(value));
}

/** "1.8c" -- the cents-per-point unit, written the way people say it. */
export function formatCpp(centsPerPoint: number): string {
  const rounded = Math.round(centsPerPoint * 100) / 100;
  return `${rounded}¢`;
}

export function formatPercent(ratio: number, digits = 0): string {
  return `${(ratio * 100).toFixed(digits)}%`;
}

/**
 * Accepts what a person actually types into a dollar field: "4000", "$4,000",
 * "4000.00", "4,000.5". Returns null for anything else so a bad paste becomes
 * a validation message instead of a NaN that silently zeroes a total.
 */
export function parseDollarsToCents(input: string): number | null {
  const cleaned = input.replace(/[$,\s]/g, '').trim();
  if (cleaned === '') return null;
  if (!/^-?\d*\.?\d*$/.test(cleaned)) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

/** Accepts "125000", "125,000". Returns null for anything else. */
export function parseIntegerInput(input: string): number | null {
  const cleaned = input.replace(/[,\s]/g, '').trim();
  if (cleaned === '') return null;
  if (!/^-?\d+$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

/** Cents back into a plain editable string -- "4000.00", no symbol, no commas. */
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2);
}
