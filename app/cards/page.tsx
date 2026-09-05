'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useData } from '@/components/DataProvider';
import { CardEditor } from '@/components/CardEditor';
import { CardList } from '@/components/CardList';
import { EligibilityPanel } from '@/components/EligibilityPanel';
import { PerkChecklist } from '@/components/PerkChecklist';
import { WalletCheatSheet } from '@/components/WalletCheatSheet';
import { Button, EmptyState, Panel, PanelHeader, Stat, StatRow } from '@/components/ui';
import { feeTotals } from '@/lib/fees';
import { formatDollars } from '@/lib/money';
import { sampleData } from '@/lib/sample';
import { blankCard } from '@/lib/storage';
import type { CardAccount } from '@/lib/types';

function CardsPageInner() {
  const { data, ready, upsertCard, removeCard, replaceAll } = useData();
  const router = useRouter();
  const params = useSearchParams();
  const requestedId = params.get('card');

  const [editing, setEditing] = useState<CardAccount | null>(null);
  const [showClosed, setShowClosed] = useState(false);

  // The dashboard links to a specific card with ?card=<id>; open it once the
  // stored data has actually loaded.
  useEffect(() => {
    if (!ready || !requestedId) return;
    const card = data.cards.find((c) => c.id === requestedId);
    if (card) setEditing(card);
  }, [ready, requestedId, data.cards]);

  function close() {
    setEditing(null);
    if (requestedId) router.replace('/cards');
  }

  if (!ready) return <p className="text-sm text-dim">Loading your cards...</p>;

  if (editing) {
    return (
      <CardEditor
        initial={editing}
        onSave={(card) => {
          upsertCard(card);
          close();
        }}
        onCancel={close}
        onDelete={
          data.cards.some((c) => c.id === editing.id)
            ? () => {
                removeCard(editing.id);
                close();
              }
            : undefined
        }
      />
    );
  }

  const open = data.cards.filter((c) => c.status === 'open');
  const closed = data.cards.filter((c) => c.status === 'closed');
  const totals = feeTotals(data.cards);
  const visible = showClosed ? data.cards : open;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text">Cards</h1>
          <p className="mt-1 text-sm text-muted">
            {open.length} open{closed.length > 0 ? ` · ${closed.length} closed` : ''}
          </p>
        </div>
        <Button variant="primary" onClick={() => setEditing(blankCard())}>
          Add a card
        </Button>
      </div>

      {data.cards.length === 0 ? (
        <EmptyState
          title="No cards yet"
          description="Pick a product from the catalog and it fills in the annual fee, rewards program, and typical bonus window -- you type the open date."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="primary" onClick={() => setEditing(blankCard())}>
                Add a card
              </Button>
              <Button onClick={() => replaceAll(sampleData())}>Load sample data</Button>
            </div>
          }
        />
      ) : (
        <>
          <StatRow>
            <Stat
              label="Annual fees"
              value={totals.annualFeeCents}
              format={formatDollars}
              hint={`across ${totals.cardCount} fee-carrying ${
                totals.cardCount === 1 ? 'card' : 'cards'
              }`}
              tone={totals.annualFeeCents > 0 ? 'warn' : 'neutral'}
            />
            <Stat
              label="Credits used"
              value={totals.annualCreditsCents}
              format={formatDollars}
              hint="what you say the perks are worth to you"
              tone="ok"
            />
            <Stat
              label="Net annual cost"
              value={totals.netCents}
              format={formatDollars}
              hint="fees minus credits you actually use"
              tone={totals.netCents > 0 ? 'warn' : 'ok'}
            />
          </StatRow>

          {closed.length > 0 ? (
            <label className="flex items-center gap-2 text-sm text-muted">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[rgb(var(--accent))]"
                checked={showClosed}
                onChange={(e) => setShowClosed(e.target.checked)}
              />
              Show {closed.length} closed {closed.length === 1 ? 'card' : 'cards'}
            </label>
          ) : null}

          <Panel>
            <CardList cards={visible} settings={data.settings} onEdit={setEditing} />
          </Panel>

          <WalletCheatSheet cards={data.cards} overrides={data.valuationOverrides} />

          <PerkChecklist cards={data.cards} onToggle={upsertCard} />

          <EligibilityPanel cards={data.cards} />

          <Panel>
            <PanelHeader
              title="Why this is typed in rather than connected"
              description="It is the honest answer to 'can it just pull my accounts', and it explains what the app can and cannot know."
            />
            <div className="space-y-3 text-sm leading-relaxed text-muted">
              <p>
                Bank aggregators (Plaid and the like) can read balances and
                transactions. They cannot read the three things this dashboard is
                built around: when your annual fee posts, what your sign-up bonus
                terms are, or what your points balance is. No card issuer exposes
                any of that to a third party.
              </p>
              <p>
                The services that do show points balances work by storing your
                actual card logins and signing in as you. That is a real trade,
                and not one worth making to avoid typing an open date once.
              </p>
              <p>
                Transactions are the one piece that genuinely helps, because
                totalling them is how bonus progress gets tracked -- so the
                Bonuses tab imports the CSV your issuer already lets you download,
                no credentials involved.
              </p>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}

export default function CardsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-dim">Loading your cards...</p>}>
      <CardsPageInner />
    </Suspense>
  );
}
