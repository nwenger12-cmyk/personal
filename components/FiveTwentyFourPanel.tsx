'use client';

import { formatDate } from '@/lib/dates';
import { ISSUER_LABELS } from '@/lib/types';
import type { FiveTwentyFourStatus } from '@/lib/rules';
import { ISSUER_RULES } from '@/lib/rules';
import { Badge, Panel, PanelHeader } from './ui';

/**
 * The 5/24 counter, plus the fall-off dates that say when it changes. The
 * issuer rules underneath are reference text: only 5/24 is computed, because
 * only 5/24 follows from the card list itself.
 */
export function FiveTwentyFourPanel({ status }: { status: FiveTwentyFourStatus }) {
  const tone = status.underLimit ? 'ok' : 'danger';
  const auCount = status.count - status.countExcludingAuthorizedUser;

  return (
    <Panel>
      <PanelHeader
        title="Chase 5/24"
        description="Personal cards opened in the last 24 months, from every issuer. Five or more and Chase will almost always decline."
        action={
          <Badge tone={tone} mono>
            {status.count}/24
          </Badge>
        }
      />

      <p className="text-sm leading-relaxed text-muted">
        {status.underLimit ? (
          <>
            You are under the limit with{' '}
            <span className="font-mono text-text">{status.limit - status.count}</span>{' '}
            {status.limit - status.count === 1 ? 'slot' : 'slots'} to spare.
          </>
        ) : (
          <>
            You are at or over the limit.
            {status.clearsOn ? (
              <>
                {' '}Next eligible around{' '}
                <span className="font-mono text-text">{formatDate(status.clearsOn)}</span>,
                when enough of these age out.
              </>
            ) : null}
          </>
        )}
        {auCount > 0 ? (
          <>
            {' '}
            {auCount} of these {auCount === 1 ? 'is an authorized-user card' : 'are authorized-user cards'};
            Chase will sometimes discount those if you call and explain, which
            would put you at{' '}
            <span className="font-mono text-text">{status.countExcludingAuthorizedUser}</span>.
          </>
        ) : null}
      </p>

      {status.entries.length > 0 ? (
        <ul className="mt-4 divide-y divide-line border-t border-line">
          {status.entries.map((entry) => (
            <li
              key={entry.cardId}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5"
            >
              <span className="min-w-0">
                <span className="text-sm text-text">{entry.label}</span>
                <span className="ml-2 text-xs text-dim">
                  {ISSUER_LABELS[entry.issuer]}
                  {entry.authorizedUser ? ' · authorized user' : ''}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block font-mono text-xs text-muted">
                  opened {formatDate(entry.openedDate)}
                </span>
                <span className="block font-mono text-xs text-dim">
                  falls off {formatDate(entry.fallsOffDate)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-dim">
          Nothing counting against you right now.
        </p>
      )}

      <details className="mt-4 border-t border-line pt-4">
        <summary className="cursor-pointer text-sm font-medium text-text">
          Other issuer application rules
        </summary>
        <p className="mt-2 text-xs leading-relaxed text-dim">
          Community-documented patterns rather than published policy -- they get
          adjusted without notice, so treat them as a prompt to check, not as
          fact.
        </p>
        <ul className="mt-3 space-y-3">
          {ISSUER_RULES.map((rule) => (
            <li key={`${rule.issuer}-${rule.title}`}>
              <span className="text-sm font-medium text-text">
                {ISSUER_LABELS[rule.issuer]}: {rule.title}
              </span>
              <span className="mt-0.5 block text-sm leading-relaxed text-muted">
                {rule.detail}
              </span>
            </li>
          ))}
        </ul>
      </details>
    </Panel>
  );
}
