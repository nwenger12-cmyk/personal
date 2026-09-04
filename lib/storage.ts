import { isIsoDate, today } from './dates';
import type { IsoDate } from './dates';
import { getCatalogCard } from './catalog';
import type { CatalogCard } from './catalog';
import { UNCATEGORIZED_ID, getCategory } from './categories';
import {
  DATA_VERSION,
  DEFAULT_SETTINGS,
  ISSUER_ORDER,
  defaultEntities,
  emptyData,
} from './types';
import type {
  AppData,
  CardAccount,
  CategorizationRule,
  Entity,
  Expense,
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

function coerceEntities(value: unknown): Entity[] {
  if (!Array.isArray(value)) return defaultEntities();
  const seen = new Set<string>();
  const entities = value.flatMap((entry): Entity[] => {
    if (!entry || typeof entry !== 'object') return [];
    const e = entry as Record<string, unknown>;
    const id = str(e.id) || newId();
    if (seen.has(id)) return [];
    seen.add(id);
    return [{
      id,
      name: str(e.name, 'Unnamed'),
      kind: e.kind === 'personal' ? 'personal' : 'business',
      notes: str(e.notes),
    }];
  });
  // A store with no entities has nowhere to file an expense, so seed rather
  // than leaving the expense form with an empty picker.
  return entities.length > 0 ? entities : defaultEntities();
}

function coercePercent(value: unknown, fallback: number): number {
  const n = num(value, fallback);
  return Math.max(0, Math.min(100, Math.round(n)));
}

function coerceExpenses(value: unknown, entities: Entity[]): Expense[] {
  if (!Array.isArray(value)) return [];
  const entityIds = new Set(entities.map((e) => e.id));
  const fallbackEntity = entities[0]?.id ?? '';

  return value.flatMap((entry): Expense[] => {
    if (!entry || typeof entry !== 'object') return [];
    const e = entry as Record<string, unknown>;
    const when = nullableDate(e.date);
    // Without a valid date an expense has no tax year, which is the one thing
    // it cannot be missing. Drop it rather than filing it under today.
    if (!when) return [];

    const rawCategory = typeof e.categoryId === 'string' ? e.categoryId : null;
    const categoryId = getCategory(rawCategory) ? (rawCategory as string) : UNCATEGORIZED_ID;
    const entityId =
      typeof e.entityId === 'string' && entityIds.has(e.entityId)
        ? e.entityId
        : fallbackEntity;
    const source =
      e.source === 'import' || e.source === 'card-fee' ? e.source : 'manual';

    return [{
      id: str(e.id) || newId(),
      date: when,
      amountCents: Math.round(num(e.amountCents)),
      merchant: str(e.merchant),
      description: str(e.description),
      entityId,
      categoryId,
      cardId: typeof e.cardId === 'string' ? e.cardId : null,
      deductiblePercent: coercePercent(
        e.deductiblePercent,
        getCategory(categoryId)?.defaultDeductiblePercent ?? 100,
      ),
      reviewed: bool(e.reviewed),
      receiptNote: str(e.receiptNote),
      source,
      importKey: typeof e.importKey === 'string' ? e.importKey : null,
      notes: str(e.notes),
    }];
  });
}

function coerceRules(value: unknown): CategorizationRule[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): CategorizationRule[] => {
    if (!entry || typeof entry !== 'object') return [];
    const r = entry as Record<string, unknown>;
    const match = str(r.match).trim();
    if (!match) return [];
    const categoryId = typeof r.categoryId === 'string' ? r.categoryId : null;
    if (!getCategory(categoryId)) return [];
    return [{
      id: str(r.id) || newId(),
      match,
      categoryId: categoryId as string,
      entityId: typeof r.entityId === 'string' ? r.entityId : null,
      deductiblePercent:
        typeof r.deductiblePercent === 'number' && Number.isFinite(r.deductiblePercent)
          ? coercePercent(r.deductiblePercent, 100)
          : null,
      builtIn: false,
    }];
  });
}

function coerceSettings(value: unknown, entities: Entity[]): Settings {
  if (!value || typeof value !== 'object') {
    return { ...DEFAULT_SETTINGS, defaultEntityId: entities[0]?.id ?? null };
  }
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
    activeTaxYear: Math.min(
      2200,
      Math.max(1990, Math.round(num(s.activeTaxYear, new Date().getFullYear()))),
    ),
    defaultEntityId:
      typeof s.defaultEntityId === 'string' &&
      entities.some((e) => e.id === s.defaultEntityId)
        ? s.defaultEntityId
        : entities[0]?.id ?? null,
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
  // Order matters: expenses and settings are both validated against the
  // entity list, so entities have to be resolved first. A v1 export has no
  // entities at all and picks up the seeded pair here.
  const entities = coerceEntities(d.entities);

  return {
    version: DATA_VERSION,
    cards,
    balances: coerceBalances(d.balances),
    valuationOverrides: coerceValuations(d.valuationOverrides),
    entities,
    expenses: coerceExpenses(d.expenses, entities),
    categorizationRules: coerceRules(d.categorizationRules),
    settings: coerceSettings(d.settings, entities),
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

export function blankExpense(
  entityId: string,
  date: IsoDate = today(),
): Expense {
  return {
    id: newId(),
    date,
    amountCents: 0,
    merchant: '',
    description: '',
    entityId,
    categoryId: UNCATEGORIZED_ID,
    cardId: null,
    deductiblePercent: 100,
    reviewed: true,
    receiptNote: '',
    source: 'manual',
    importKey: null,
    notes: '',
  };
}

/**
 * Applying a category also resets the deductible percentage to that category's
 * default -- moving an expense to Meals should pick up the 50% cap rather than
 * silently keeping the 100% it had under Supplies. An explicit override is
 * re-entered after; that is the safer direction to be wrong in.
 */
export function withCategory(expense: Expense, categoryId: string): Expense {
  const category = getCategory(categoryId);
  return {
    ...expense,
    categoryId,
    deductiblePercent: category?.defaultDeductiblePercent ?? expense.deductiblePercent,
  };
}

export function blankEntity(): Entity {
  return { id: newId(), name: '', kind: 'business', notes: '' };
}
