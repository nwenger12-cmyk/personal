'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useData } from './DataProvider';

const NAV = [
  { href: '/', label: 'Dashboard' },
  { href: '/cards', label: 'Cards' },
  { href: '/bonuses', label: 'Bonuses' },
  { href: '/points', label: 'Points' },
  { href: '/import', label: 'Import' },
  { href: '/expenses', label: 'Spending' },
  { href: '/taxes', label: 'Taxes' },
  { href: '/settings', label: 'Settings' },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { persistFailed } = useData();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
          <Link href="/" className="text-sm font-semibold tracking-tight text-text">
            Card Hub
          </Link>
          <nav className="flex flex-wrap items-center gap-1">
            {NAV.map((item) => {
              const active =
                item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-accent/12 text-accent-ink'
                      : 'text-muted hover:bg-surface-2 hover:text-text'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {persistFailed ? (
        <div className="border-b border-danger/30 bg-danger/10">
          <p className="mx-auto max-w-6xl px-4 py-2 text-sm text-danger-ink sm:px-6">
            Changes are not being saved -- this browser is blocking site storage
            (a private window will do it). Export your data from Settings before
            closing the tab.
          </p>
        </div>
      ) : null}

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>

      <footer className="mx-auto max-w-6xl px-4 pb-10 sm:px-6">
        <p className="border-t border-line pt-4 text-xs leading-relaxed text-dim">
          Everything here is stored in this browser only -- nothing is sent
          anywhere. Back it up from Settings.
        </p>
      </footer>
    </div>
  );
}
