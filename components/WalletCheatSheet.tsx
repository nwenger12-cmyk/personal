'use client';

import { useMemo, useState } from 'react';
import { EARN_CATEGORIES, guessEarnCategory, rankCardsForCategory, walletCheatSheet } from '@/lib/earning';
import { formatCents, formatCpp } from '@/lib/money';
import type { CardAccount } from '@/lib/types';
import { Stagger, StaggerItem } from './motion';
import { Badge, Button, Field, Note, Panel, PanelHeader, Select, TextInput } from './ui';

/**
 * Which card to reach for.
 *
 * Every row resolves to cents back per dollar, because that is the only way to
 * compare "3x points" with "2% cash". The multiplier alone says nothing until
 * it is multiplied by what the point is worth -- and since those valuations are
 * yours to edit, so is this ranking.
 */
export function WalletCheatSheet({
  cards,
  overrides,
}: {
  cards: CardAccount[];
  overrides: Record<string, number>;
}) {
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState('dining');

  const guessed = useMemo(() => (query.trim() ? guessEarnCategory(query) : null), [query]);
  const activeCategory = guessed?.id ?? categoryId;

  const ranked = useMemo(
    () => rankCardsForCategory(cards, activeCategory, overrides).slice(0, 4),
    [cards, activeCategory, overrides],
  );
  const sheet = useMemo(() => walletCheatSheet(cards, overrides), [cards, overrides]);

  const openCards = cards.filter((c) => c.status === 'open');
  const withRates = openCards.filter((c) => c.earnRates.length > 0).length;

  return (
    <Panel className="space-y-5">
      <PanelHeader
        title="Which card to use"
        description="Ranked by what you actually get back per dollar — the multiplier times what a point is worth in that programme."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Where are you spending?"
          hint={guessed ? `Reading that as ${guessed.label.toLowerCase()}.` : 'Type a merchant, or pick below.'}
        >
          <TextInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Whole Foods, Delta, Shell…"
          />
        </Field>
        <Field label="Category">
          <Select
            value={activeCategory}
            onChange={(e) => {
              setQuery('');
              setCategoryId(e.target.value);
            }}
          >
            {EARN_CATEGORIES.map((category) => (
              <option key={category.id} value={category.id}>
                {category.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {ranked.length === 0 ? (
        <p className="text-sm text-dim">No open cards to compare.</p>
      ) : (
        <Stagger as="ul" className="divide-y divide-line border-t border-line">
          {ranked.map((entry, index) => (
            <StaggerItem
              as="li"
              key={entry.card.id}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3"
            >
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-text">{entry.label}</span>
                  {index === 0 ? <Badge tone="ok">Use this</Badge> : null}
                  {entry.rate === null ? <Badge>base rate</Badge> : null}
                </span>
                <span className="mt-0.5 block text-xs text-dim">
                  {entry.multiplier}x {entry.programShortName} at {formatCpp(entry.centsPerPoint)}
                  {entry.capCents ? ` · capped at ${formatCents(entry.capCents)} a year` : ''}
                </span>
              </span>
              <span className="font-mono text-sm text-text">
                {entry.centsPerDollar.toFixed(2)}¢<span className="text-dim"> / $1</span>
              </span>
            </StaggerItem>
          ))}
        </Stagger>
      )}

      {withRates < openCards.length ? (
        <Note>
          {openCards.length - withRates} of your {openCards.length} open cards have no
          earning rates entered, so they are being compared at 1x. Add rates on each
          card to make this ranking real.
        </Note>
      ) : null}

      <details>
        <summary className="cursor-pointer text-sm font-medium text-text">
          The whole cheat sheet
        </summary>
        <ul className="mt-3 divide-y divide-line border-t border-line">
          {sheet.map(({ category, best }) => (
            <li
              key={category.id}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2 text-sm"
            >
              <span className="text-muted">{category.label}</span>
              <span className="flex items-baseline gap-3">
                <span className="text-text">{best.label}</span>
                <span className="font-mono text-xs text-dim">
                  {best.centsPerDollar.toFixed(2)}¢
                </span>
              </span>
            </li>
          ))}
        </ul>
      </details>
    </Panel>
  );
}
