/**
 * Every date in this app is a plain `YYYY-MM-DD` string and every calculation
 * on one happens in UTC.
 *
 * That is deliberate. An account open date is a calendar fact, not an instant:
 * a card opened "2024-03-15" was opened on the 15th no matter what timezone
 * you read the dashboard from. Storing a Date (or an ISO timestamp) and
 * formatting it locally makes the anniversary silently land a day early for
 * anyone west of UTC, which quietly moves every annual-fee prediction.
 */

export type IsoDate = string; // YYYY-MM-DD

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

export function isIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== 'string') return false;
  const m = ISO_RE.exec(value);
  if (!m) return false;
  const [, y, mo, d] = m;
  const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
  // Rejects 2024-02-30 and friends, which Date.UTC would happily roll over.
  return (
    date.getUTCFullYear() === Number(y) &&
    date.getUTCMonth() === Number(mo) - 1 &&
    date.getUTCDate() === Number(d)
  );
}

function parts(iso: IsoDate): [number, number, number] {
  const m = ISO_RE.exec(iso);
  if (!m) throw new Error(`Not a YYYY-MM-DD date: ${iso}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

export function toUtcMs(iso: IsoDate): number {
  const [y, m, d] = parts(iso);
  return Date.UTC(y, m - 1, d);
}

export function fromUtcMs(ms: number): IsoDate {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Today in the viewer's own calendar, expressed as a UTC-safe date string. */
export function today(now: Date = new Date()): IsoDate {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(iso: IsoDate, days: number): IsoDate {
  return fromUtcMs(toUtcMs(iso) + days * MS_PER_DAY);
}

/**
 * Calendar-month arithmetic, clamped to the end of the target month, so
 * Jan 31 + 1 month is Feb 28/29 rather than rolling into March. Issuers count
 * a "3 month" bonus window in calendar months, not in 90 days.
 */
export function addMonths(iso: IsoDate, months: number): IsoDate {
  const [y, m, d] = parts(iso);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return fromUtcMs(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), Math.min(d, lastDay)),
  );
}

/** Feb 29 + 1 year lands on Feb 28, same clamping rule as addMonths. */
export function addYears(iso: IsoDate, years: number): IsoDate {
  return addMonths(iso, years * 12);
}

/** Whole days from `a` to `b`. Negative when `b` is in the past. */
export function daysBetween(a: IsoDate, b: IsoDate): number {
  return Math.round((toUtcMs(b) - toUtcMs(a)) / MS_PER_DAY);
}

/** Whole calendar months elapsed from `a` to `b`, ignoring the partial month. */
export function monthsBetween(a: IsoDate, b: IsoDate): number {
  const [ay, am, ad] = parts(a);
  const [by, bm, bd] = parts(b);
  return (by - ay) * 12 + (bm - am) - (bd < ad ? 1 : 0);
}

export function minDate(a: IsoDate, b: IsoDate): IsoDate {
  return toUtcMs(a) <= toUtcMs(b) ? a : b;
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** "Mar 15, 2024" -- formatted from the parts, never through a local Date. */
export function formatDate(iso: IsoDate): string {
  const [y, m, d] = parts(iso);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

/** "Mar 15" -- the day within an already-labelled month. */
export function formatDayMonth(iso: IsoDate): string {
  const [, m, d] = parts(iso);
  return `${MONTHS[m - 1]} ${d}`;
}

/** "Mar 2024" -- for month-grouped timelines. */
export function formatMonth(iso: IsoDate): string {
  const [y, m] = parts(iso);
  return `${MONTHS[m - 1]} ${y}`;
}

export function monthKey(iso: IsoDate): string {
  return iso.slice(0, 7);
}

/** "in 12 days" / "today" / "34 days ago" */
export function relativeDays(days: number): string {
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days === -1) return 'yesterday';
  if (days > 0) return `in ${days} days`;
  return `${Math.abs(days)} days ago`;
}
