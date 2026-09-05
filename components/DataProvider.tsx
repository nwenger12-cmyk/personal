'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { today } from '@/lib/dates';
import { emptyData } from '@/lib/types';
import type {
  AppData,
  CardAccount,
  CategorizationRule,
  Entity,
  Expense,
  MileageTrip,
  ProgramBalance,
  Settings,
} from '@/lib/types';
import { loadData, saveData } from '@/lib/storage';

type DataContextValue = {
  data: AppData;
  /** False until localStorage has been read -- the server render has no data. */
  ready: boolean;
  /** True when a write failed (private window, blocked site data, quota). */
  persistFailed: boolean;
  upsertCard: (card: CardAccount) => void;
  removeCard: (cardId: string) => void;
  setBalance: (programId: string, amount: number) => void;
  removeBalance: (programId: string) => void;
  setValuation: (key: string, centsPerPoint: number | null) => void;
  upsertExpense: (expense: Expense) => void;
  /** Bulk write for CSV import and for filing a batch from the review queue. */
  upsertExpenses: (expenses: Expense[]) => void;
  removeExpense: (expenseId: string) => void;
  removeExpenses: (expenseIds: string[]) => void;
  upsertEntity: (entity: Entity) => void;
  removeEntity: (entityId: string) => void;
  addRule: (rule: CategorizationRule) => void;
  removeRule: (ruleId: string) => void;
  addTrip: (trip: MileageTrip) => void;
  removeTrip: (tripId: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  replaceAll: (data: AppData) => void;
  resetAll: () => void;
};

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(emptyData);
  const [ready, setReady] = useState(false);
  const [persistFailed, setPersistFailed] = useState(false);

  // localStorage does not exist during the server render, so the first paint
  // is always the empty state and the real data arrives on mount.
  useEffect(() => {
    setData(loadData());
    setReady(true);
  }, []);

  // One write path: every mutator goes through this, so nothing can change
  // state without also being persisted.
  const commit = useCallback((next: AppData) => {
    setData(next);
    setPersistFailed(!saveData(next));
  }, []);

  const upsertCard = useCallback(
    (card: CardAccount) => {
      setData((current) => {
        const index = current.cards.findIndex((c) => c.id === card.id);
        const cards =
          index === -1
            ? [...current.cards, card]
            : current.cards.map((c) => (c.id === card.id ? card : c));
        const next = { ...current, cards };
        setPersistFailed(!saveData(next));
        return next;
      });
    },
    [],
  );

  const removeCard = useCallback((cardId: string) => {
    setData((current) => {
      const next = { ...current, cards: current.cards.filter((c) => c.id !== cardId) };
      setPersistFailed(!saveData(next));
      return next;
    });
  }, []);

  const setBalance = useCallback((programId: string, amount: number) => {
    setData((current) => {
      const previous = current.balances.find((b) => b.programId === programId);
      const entry: ProgramBalance = {
        programId,
        amount: Math.max(0, Math.round(amount)),
        updated: today(),
        // A changed balance means the account saw activity, which is what
        // resets an expiry clock -- re-typing the same number does not.
        lastActivity:
          previous && previous.amount === Math.max(0, Math.round(amount))
            ? previous.lastActivity
            : today(),
      };
      const exists = current.balances.some((b) => b.programId === programId);
      const balances = exists
        ? current.balances.map((b) => (b.programId === programId ? entry : b))
        : [...current.balances, entry];
      const next = { ...current, balances };
      setPersistFailed(!saveData(next));
      return next;
    });
  }, []);

  const removeBalance = useCallback((programId: string) => {
    setData((current) => {
      const next = {
        ...current,
        balances: current.balances.filter((b) => b.programId !== programId),
      };
      setPersistFailed(!saveData(next));
      return next;
    });
  }, []);

  const setValuation = useCallback((key: string, centsPerPoint: number | null) => {
    setData((current) => {
      const valuationOverrides = { ...current.valuationOverrides };
      if (centsPerPoint === null) delete valuationOverrides[key];
      else valuationOverrides[key] = centsPerPoint;
      const next = { ...current, valuationOverrides };
      setPersistFailed(!saveData(next));
      return next;
    });
  }, []);


  const upsertExpense = useCallback((expense: Expense) => {
    setData((current) => {
      const index = current.expenses.findIndex((e) => e.id === expense.id);
      const expenses =
        index === -1
          ? [...current.expenses, expense]
          : current.expenses.map((e) => (e.id === expense.id ? expense : e));
      const next = { ...current, expenses };
      setPersistFailed(!saveData(next));
      return next;
    });
  }, []);

  /**
   * One write for a whole batch. An import of 200 rows through the single
   * upsert would be 200 renders and 200 localStorage writes; this is one of
   * each, and the id map keeps it linear rather than quadratic.
   */
  const upsertExpenses = useCallback((incoming: Expense[]) => {
    if (incoming.length === 0) return;
    setData((current) => {
      const byId = new Map(current.expenses.map((e) => [e.id, e]));
      for (const expense of incoming) byId.set(expense.id, expense);
      const next = { ...current, expenses: [...byId.values()] };
      setPersistFailed(!saveData(next));
      return next;
    });
  }, []);

  const removeExpense = useCallback((expenseId: string) => {
    setData((current) => {
      const next = {
        ...current,
        expenses: current.expenses.filter((e) => e.id !== expenseId),
      };
      setPersistFailed(!saveData(next));
      return next;
    });
  }, []);

  const removeExpenses = useCallback((expenseIds: string[]) => {
    if (expenseIds.length === 0) return;
    setData((current) => {
      const drop = new Set(expenseIds);
      const next = {
        ...current,
        expenses: current.expenses.filter((e) => !drop.has(e.id)),
      };
      setPersistFailed(!saveData(next));
      return next;
    });
  }, []);

  const upsertEntity = useCallback((entity: Entity) => {
    setData((current) => {
      const index = current.entities.findIndex((e) => e.id === entity.id);
      const entities =
        index === -1
          ? [...current.entities, entity]
          : current.entities.map((e) => (e.id === entity.id ? entity : e));
      const next = { ...current, entities };
      setPersistFailed(!saveData(next));
      return next;
    });
  }, []);

  /**
   * Deleting an entity moves its expenses to whatever entity remains rather
   * than deleting them. Losing a year of categorised spend because an entity
   * was renamed the hard way is not a recoverable mistake.
   */
  const removeEntity = useCallback((entityId: string) => {
    setData((current) => {
      if (current.entities.length <= 1) return current;
      const entities = current.entities.filter((e) => e.id !== entityId);
      const fallback = entities[0].id;
      const expenses = current.expenses.map((e) =>
        e.entityId === entityId ? { ...e, entityId: fallback } : e,
      );
      const next = {
        ...current,
        entities,
        expenses,
        settings: {
          ...current.settings,
          defaultEntityId:
            current.settings.defaultEntityId === entityId
              ? fallback
              : current.settings.defaultEntityId,
        },
      };
      setPersistFailed(!saveData(next));
      return next;
    });
  }, []);

  const addRule = useCallback((rule: CategorizationRule) => {
    setData((current) => {
      const next = {
        ...current,
        categorizationRules: [...current.categorizationRules, rule],
      };
      setPersistFailed(!saveData(next));
      return next;
    });
  }, []);

  const removeRule = useCallback((ruleId: string) => {
    setData((current) => {
      const next = {
        ...current,
        categorizationRules: current.categorizationRules.filter((r) => r.id !== ruleId),
      };
      setPersistFailed(!saveData(next));
      return next;
    });
  }, []);

  const addTrip = useCallback((trip: MileageTrip) => {
    setData((current) => {
      const next = { ...current, mileage: [...current.mileage, trip] };
      setPersistFailed(!saveData(next));
      return next;
    });
  }, []);

  const removeTrip = useCallback((tripId: string) => {
    setData((current) => {
      const next = { ...current, mileage: current.mileage.filter((t) => t.id !== tripId) };
      setPersistFailed(!saveData(next));
      return next;
    });
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setData((current) => {
      const next = { ...current, settings: { ...current.settings, ...patch } };
      setPersistFailed(!saveData(next));
      return next;
    });
  }, []);

  const replaceAll = useCallback((next: AppData) => commit(next), [commit]);
  const resetAll = useCallback(() => commit(emptyData()), [commit]);

  /**
   * The theme choice lives in the same store as everything else and lands on
   * <html> as a concrete `light` or `dark`. "System" is resolved here rather
   * than by a media query in CSS, so there is exactly one source of truth --
   * globals.css only ever reads the attribute, and no component reads either.
   */
  useEffect(() => {
    if (!ready) return;
    const root = document.documentElement;
    const preference = data.settings.theme;

    if (preference !== 'system') {
      root.setAttribute('data-theme', preference);
      return;
    }

    const query = window.matchMedia('(prefers-color-scheme: light)');
    const apply = () => root.setAttribute('data-theme', query.matches ? 'light' : 'dark');
    apply();
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, [data.settings.theme, ready]);

  const value = useMemo(
    () => ({
      data,
      ready,
      persistFailed,
      upsertCard,
      removeCard,
      setBalance,
      removeBalance,
      setValuation,
      upsertExpense,
      upsertExpenses,
      removeExpense,
      removeExpenses,
      upsertEntity,
      removeEntity,
      addRule,
      removeRule,
      addTrip,
      removeTrip,
      updateSettings,
      replaceAll,
      resetAll,
    }),
    [
      data, ready, persistFailed, upsertCard, removeCard, setBalance,
      removeBalance, setValuation, upsertExpense, upsertExpenses, removeExpense,
      removeExpenses, upsertEntity, removeEntity, addRule, removeRule,
      addTrip, removeTrip, updateSettings, replaceAll, resetAll,
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside <DataProvider>');
  return ctx;
}
