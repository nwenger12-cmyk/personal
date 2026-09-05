'use client';

import Link from 'next/link';
import type { AttentionItem, Severity } from '@/lib/attention';
import { Stagger, StaggerItem } from './motion';
import { Badge, Button, Panel, PanelHeader } from './ui';

const TONE: Record<Severity, 'danger' | 'warn' | 'neutral'> = {
  now: 'danger',
  soon: 'warn',
  idle: 'neutral',
};

const LABEL: Record<Severity, string> = {
  now: 'Now',
  soon: 'Soon',
  idle: 'When you get a chance',
};

/**
 * The single list of what has gone stale. This is deliberately the first thing
 * on the dashboard: the failure mode of a tracker is not that its arithmetic
 * is wrong, it is that you stopped feeding it and did not notice.
 */
export function AttentionPanel({ items }: { items: AttentionItem[] }) {
  if (items.length === 0) {
    return (
      <Panel className="ring-ok/25">
        <PanelHeader
          title="Everything is current"
          description="No fees inside their review window, no bonus behind pace, nothing waiting to be categorised, and every card has recent transactions."
        />
      </Panel>
    );
  }

  const urgent = items.filter((i) => i.severity === 'now').length;

  return (
    <Panel className={urgent > 0 ? 'ring-danger/25' : ''}>
      <PanelHeader
        title="Needs you"
        description="Everything the tracker cannot work out on its own, in the order it matters."
        action={
          <Badge tone={urgent > 0 ? 'danger' : 'warn'} mono>
            {items.length}
          </Badge>
        }
      />
      <Stagger as="ul" className="divide-y divide-line border-t border-line" delay={0.1}>
        {items.map((item) => (
          <StaggerItem
            as="li"
            key={item.id}
            className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 py-3.5"
          >
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-text">{item.title}</span>
                <Badge tone={TONE[item.severity]}>{LABEL[item.severity]}</Badge>
              </span>
              <span className="mt-0.5 block text-sm leading-relaxed text-muted">
                {item.detail}
              </span>
            </span>
            <Link href={item.href} className="shrink-0">
              <Button size="sm">{item.actionLabel}</Button>
            </Link>
          </StaggerItem>
        ))}
      </Stagger>
    </Panel>
  );
}
