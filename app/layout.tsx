import type { Metadata } from 'next';
import { DataProvider } from '@/components/DataProvider';
import { AppShell } from '@/components/AppShell';
import { STORAGE_KEY } from '@/lib/storage';
import './globals.css';

export const metadata: Metadata = {
  title: 'Card Hub',
  description:
    'Annual fees, sign-up bonuses, and points across every card, in one place.',
  robots: { index: false, follow: false },
};

/**
 * Resolves the stored theme before first paint, so choosing light does not
 * flash dark on the way in. `:root` is already dark, so the only work here is
 * stamping `light` when that is what was chosen -- including when the choice
 * is "system" and the OS says light.
 */
const THEME_SCRIPT = `
(function () {
  try {
    var raw = localStorage.getItem(${JSON.stringify(STORAGE_KEY)});
    var theme = raw ? (JSON.parse(raw).settings || {}).theme : 'dark';
    if (theme === 'system') {
      theme = window.matchMedia('(prefers-color-scheme: light)').matches
        ? 'light'
        : 'dark';
    }
    document.documentElement.setAttribute('data-theme', theme === 'light' ? 'light' : 'dark');
  } catch (e) {}
})();
`.trim();

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <DataProvider>
          <AppShell>{children}</AppShell>
        </DataProvider>
      </body>
    </html>
  );
}
