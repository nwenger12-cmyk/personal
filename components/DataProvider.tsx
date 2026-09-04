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
import type { AppData, CardAccount, ProgramBalance, Settings } from '@/lib/types';
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
      const entry: ProgramBalance = {
        programId,
        amount: Math.max(0, Math.round(amount)),
        updated: today(),
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

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setData((current) => {
      const next = { ...current, settings: { ...current.settings, ...patch } };
      setPersistFailed(!saveData(next));
      return next;
    });
  }, []);

  const replaceAll = useCallback((next: AppData) => commit(next), [commit]);
  const resetAll = useCallback(() => commit(emptyData()), [commit]);

  // The theme choice lives in the same store as everything else, and lands on
  // <html> as an attribute. globals.css does the rest -- no component reads it.
  useEffect(() => {
    if (!ready) return;
    const root = document.documentElement;
    if (data.settings.theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', data.settings.theme);
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
      updateSettings,
      replaceAll,
      resetAll,
    }),
    [
      data, ready, persistFailed, upsertCard, removeCard, setBalance,
      removeBalance, setValuation, updateSettings, replaceAll, resetAll,
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside <DataProvider>');
  return ctx;
}
