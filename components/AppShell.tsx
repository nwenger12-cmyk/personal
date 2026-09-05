'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useData } from './DataProvider';
import { MotionProvider, NavIndicator, Reveal } from './motion';

const NAV = [
  { href: '/', label: 'Home' },
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
    <MotionProvider>
      <div className="min-h-screen">
        <header className="sticky top-0 z-20 border-b border-line bg-bg/70 backdrop-blur-xl">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-8 gap-y-2 px-5 py-3.5 sm:px-8">
            <Link href="/" className="group flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-accent shadow-glow" />
              <span className="text-[13px] font-semibold uppercase tracking-label text-text">
                Card Hub
              </span>
            </Link>

            <nav className="flex flex-wrap items-center gap-0.5">
              {NAV.map((item) => {
                const active =
                  item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={`relative rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors ${
                      active ? 'text-accent-ink' : 'text-dim hover:text-text'
                    }`}
                  >
                    {/* One indicator instance travels between items, because
                        every active tab shares the same layoutId. */}
                    {active ? <NavIndicator id="nav-active" /> : null}
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </header>

        {persistFailed ? (
          <div className="border-b border-danger/30 bg-danger/10">
            <p className="mx-auto max-w-5xl px-5 py-2.5 text-sm text-danger-ink sm:px-8">
              Changes are not being saved — this browser is blocking site storage
              (a private window will do it). Export your data from Settings before
              closing the tab.
            </p>
          </div>
        ) : null}

        <main className="mx-auto max-w-5xl px-5 py-12 sm:px-8">
          {/* Keyed on the route so each page fades in on navigation. */}
          <Reveal key={pathname}>{children}</Reveal>
        </main>

        <footer className="mx-auto max-w-5xl px-5 pb-14 sm:px-8">
          <div className="rule mb-4" />
          <p className="text-xs leading-relaxed text-dim">
            Stored in this browser only — nothing is sent anywhere. Back it up
            from Settings.
          </p>
        </footer>
      </div>
    </MotionProvider>
  );
}
