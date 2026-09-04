'use client';

import Link from 'next/link';
import { formatDayMonth, formatMonth, relativeDays } from '@/lib/dates';
import { formatCents } from '@/lib/money';
import { groupByMonth } from '@/lib/timeline';
import type { TimelineEvent } from '@/lib/timeline';
import { Badge, EmptyState } from './ui';

function EventRow({ event }: { event: TimelineEvent }) {
  return (
    <li className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-3">
      <span className="w-14 shrink-0 font-mono text-xs text-dim">
        {formatDayMonth(event.date)}
      </span>

      <span className="min-w-0 flex-1">
        <Link
          href={`/cards?card=${event.cardId}`}
          className="text-sm font-medium text-text underline-offset-2 hover:underline"
        >
          {event.cardLabel}
        </Link>
        <span className="ml-2 text-sm text-muted">{event.title}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-dim">
          {event.detail}
          {event.predicted ? ' · estimated' : ''}
        </span>
      </span>

      <span className="flex shrink-0 items-center gap-2">
        {event.amountCents !== null ? (
          <span className="font-mono text-sm text-text">
            {formatCents(event.amountCents)}
          </span>
        ) : null}
        <Badge tone={event.tone} mono>
          {relativeDays(event.daysUntil)}
        </Badge>
      </span>
    </li>
  );
}

export function Timeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return (
      <EmptyState
        title="Nothing due in the next year"
        description="No annual fee is scheduled and no bonus window is open. Add a card with a fee or a bonus and it will show up here."
      />
    );
  }

  return (
    <div className="space-y-6">
      {groupByMonth(events).map((month) => (
        <div key={month.key}>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-dim">
            {formatMonth(month.anchor)}
          </h3>
          <ul className="mt-1 divide-y divide-line">
            {month.events.map((event) => (
              <EventRow key={event.id} event={event} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
