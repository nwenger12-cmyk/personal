import { isIsoDate, today } from './dates';
import type { IsoDate } from './dates';
import { getCatalogCard } from './catalog';
import type { CatalogCard } from './catalog';
import {
  DATA_VERSION,
  DEFAULT_SETTINGS,
  ISSUER_ORDER,
  emptyData,
} from './types';
import type {
  AppData,
  CardAccount,
  FeeCharge,
  Issuer,
  ProgramBalance,
  Settings,
  SignupBonus,
} from './types';

/**
 * Everything lives in this browser, under one key, and never leaves it.
 *
 * That is a deliberate trade, not a shortcut. This file holds the shape of a
 * wallet -- which cards, opened when, with what limits -- which is exactly the
 * material an account-takeover attempt is built from. There is no server to
 * breach because there is no server; the cost is that the data is per-browser,
 * so Settings ships JSON export and import to move it or back it up.
 */

export const STORAGE_KEY = 'nathan-personal.cards.v1';

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

// ---- coercion ---------------------------------------------------------------
// Anything read back from storage or an import file is untrusted: it may come
// from an older schema, a hand-edited export, or a half-written write. Every
// field is repaired to something valid rather than throwing, so one bad value
// cannot white-screen the whole dashboard.

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function num(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function bool(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function date(value: unknown, fallback: IsoDate): IsoDate {
  return isIsoDate(value) ? value : fallback;
}

function nullableDate(value: unknown): IsoDate | null {
  return isIsoDate(value) ? value : null;
}

function issuer(value: unknown): Issuer {
  return ISSUER_ORDER.includes(value as Issuer) ? (value as Issuer) : 'other';
}

function coerceBonus(value: unknown, openedDate: IsoDate): SignupBonus | null {
  if (!value || typeof value !== 'object') return null;
  const b = value as Record<string, unknown>;
  const rewardKind = b.rewardKind === 'cash' ? 'cash' : 'points';
  const status =
    b.status === 'earned' || b.status === 'missed' ? b.status : 'tracking';
  return {
    rewardKind,
    points: Math.max(0, Math.round(num(b.points))),
    cashCents: Math.max(0, Math.round(num(b.cashCents))),
    spendRequiredCents: Math.max(0, Math.round(num(b.spendRequiredCents))),
    spendWindowMonths: Math.max(1, Math.round(num(b.spendWindowMonths, 3))),
    startDate: date(b.startDate, openedDate),
    deadlineOverride: nullableDate(b.deadlineOverride),
    spendProgressCents: Math.max(0, Math.round(num(b.spendProgressCents))),
    progressUpdated: nullableDate(b.progressUpdated),
    status,
    earnedDate: nullableDate(b.earnedDate),
    postedDate: nullableDate(b.postedDate),
    notes: str(b.notes),
  };
}

function coerceFeeHistory(value: unknown): FeeCharge[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): FeeCharge[] => {
    if (!entry || typeof entry !== 'object') return [];
    const f = entry as Record<string, unknown>;
    const when = nullableDate(f.date);
    if (!when) return [];
    return [{
      id: str(f.id) || newId(),
      date: when,
      amountCents: Math.round(num(f.amountCents)),
      refunded: bool(f.refunded),
      note: str(f.note),
    }];
  });
}

function coerceCard(value: unknown): CardAccount | null {
  if (!value || typeof value !== 'object') return null;
  const c = value as Record<string, unknown>;
  const openedDate = date(c.openedDate, today());
  const closedDate = nullableDate(c.closedDate);
  return {
    id: str(c.id) || newId(),
    catalogId: typeof c.catalogId === 'string' ? c.catalogId : null,
    issuer: issuer(c.issuer),
    productName: str(c.productName, 'Untitled card'),
    nickname: str(c.nickname),
    last4: str(c.last4).replace(/\D/g, '').slice(0, 4),
    business: bool(c.business),
    authorizedUser: bool(c.authorizedUser),
    openedDate,
    closedDate,
    status: c.status === 'closed' || closedDate ? 'closed' : 'open',
    annualFeeCents: Math.max(0, Math.round(num(c.annualFeeCents))),
    firstYearFeeWaived: bool(c.firstYearFeeWaived),
    nextFeeDateOverride: nullableDate(c.nextFeeDateOverride),
    creditLimitCents:
      typeof c.creditLimitCents === 'number' && Number.isFinite(c.creditLimitCents)
        ? Math.max(0, Math.round(c.creditLimitCents))
        : null,
    programId: typeof c.programId === 'string' ? c.programId : null,
    annualCreditsValueCents: Math.max(0, Math.round(num(c.annualCreditsValueCents))),
    bonus: coerceBonus(c.bonus, openedDate),
    feeHistory: coerceFeeHistory(c.feeHistory),
    notes: str(c.notes),
  };
}

function coerceBalances(value: unknown): ProgramBalance[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap((entry): ProgramBalance[] => {
    if (!entry || typeof entry !== 'object') return [];
    const b = entry as Record<string, unknown>;
    const programId = str(b.programId);
    if (!programId || seen.has(programId)) return [];
    seen.add(programId);
    return [{
      programId,
      amount: Math.max(0, Math.round(num(b.amount))),
      updated: date(b.updated, today()),
    }];
  });
}

function coerceSettings(value: unknown): Settings {
  if (!value || typeof value !== 'object') return { ...DEFAULT_SETTINGS };
  const s = value as Record<string, unknown>;
  const theme =
    s.theme === 'light' || s.theme === 'dark' || s.theme === 'system'
      ? s.theme
      : DEFAULT_SETTINGS.theme;
  return {
    theme,
    feeReviewLeadDays: Math.min(
      365,
      Math.max(1, Math.round(num(s.feeReviewLeadDays, DEFAULT_SETTINGS.feeReviewLeadDays))),
    ),
    bonusWarnDays: Math.min(
      365,
      Math.max(1, Math.round(num(s.bonusWarnDays, DEFAULT_SETTINGS.bonusWarnDays))),
    ),
  };
}

function coerceValuations(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object') return {};
  const out: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) out[key] = raw;
  }
  return out;
}

export function coerceData(value: unknown): AppData {
  if (!value || typeof value !== 'object') return emptyData();
  const d = value as Record<string, unknown>;
  const cards = Array.isArray(d.cards)
    ? d.cards.flatMap((c) => {
        const card = coerceCard(c);
        return card ? [card] : [];
      })
    : [];
  return {
    version: DATA_VERSION,
    cards,
    balances: coerceBalances(d.balances),
    valuationOverrides: coerceValuations(d.valuationOverrides),
    settings: coerceSettings(d.settings),
    updatedAt: str(d.updatedAt, new Date().toISOString()),
  };
}

// ---- persistence ------------------------------------------------------------

export function loadData(): AppData {
  if (typeof window === 'undefined') return emptyData();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyData();
    return coerceData(JSON.parse(raw));
  } catch {
    // A private window, blocked site data, or a corrupted value. Start clean
    // rather than trapping the user on an error screen.
    return emptyData();
  }
}

export function saveData(data: AppData): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...data, updatedAt: new Date().toISOString() }),
    );
    return true;
  } catch {
    return false;
  }
}

// ---- import / export --------------------------------------------------------

export function exportJson(data: AppData): string {
  return JSON.stringify(data, null, 2);
}

export type ImportResult =
  | { ok: true; data: AppData; cardCount: number }
  | { ok: false; error: string };

export function importJson(text: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'That file is not valid JSON.' };
  }
  if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as AppData).cards)) {
    return {
      ok: false,
      error: 'That JSON does not look like a dashboard export -- no "cards" array.',
    };
  }
  const data = coerceData(parsed);
  return { ok: true, data, cardCount: data.cards.length };
}

// ---- factories --------------------------------------------------------------

export function blankCard(openedDate: IsoDate = today()): CardAccount {
  return {
    id: newId(),
    catalogId: null,
    issuer: 'chase',
    productName: '',
    nickname: '',
    last4: '',
    business: false,
    authorizedUser: false,
    openedDate,
    closedDate: null,
    status: 'open',
    annualFeeCents: 0,
    firstYearFeeWaived: false,
    nextFeeDateOverride: null,
    creditLimitCents: null,
    programId: null,
    annualCreditsValueCents: 0,
    bonus: null,
    feeHistory: [],
    notes: '',
  };
}

/** Copy a catalog product's defaults onto a card, keeping anything personal. */
export function applyCatalogCard(card: CardAccount, catalog: CatalogCard): CardAccount {
  return {
    ...card,
    catalogId: catalog.id,
    issuer: catalog.issuer,
    productName: catalog.name,
    business: catalog.business,
    annualFeeCents: catalog.annualFeeCents,
    firstYearFeeWaived: catalog.firstYearFeeWaived,
    programId: catalog.programId,
    bonus: card.bonus
      ? { ...card.bonus, spendWindowMonths: catalog.bonusWindowMonths }
      : null,
  };
}

export function cardFromCatalog(catalogId: string, openedDate: IsoDate): CardAccount {
  const catalog = getCatalogCard(catalogId);
  const card = blankCard(openedDate);
  return catalog ? applyCatalogCard(card, catalog) : card;
}

export function blankBonus(card: CardAccount): SignupBonus {
  const catalog = getCatalogCard(card.catalogId);
  const isCashProgram = card.programId === 'cash' || card.programId === 'discover-cashback';
  return {
    rewardKind: isCashProgram ? 'cash' : 'points',
    points: 0,
    cashCents: 0,
    spendRequiredCents: 0,
    spendWindowMonths: catalog?.bonusWindowMonths ?? 3,
    startDate: card.openedDate,
    deadlineOverride: null,
    spendProgressCents: 0,
    progressUpdated: null,
    status: 'tracking',
    earnedDate: null,
    postedDate: null,
    notes: '',
  };
}
