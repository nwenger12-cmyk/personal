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
 * Reads the stored theme choice before first paint so an explicit light/dark
 * pick does not flash the other theme on the way in. `system` deliberately
 * leaves the attribute off and lets the media query in globals.css decide.
 */
const THEME_SCRIPT = `
(function () {
  try {
    var raw = localStorage.getItem(${JSON.stringify(STORAGE_KEY)});
    if (!raw) return;
    var theme = (JSON.parse(raw).settings || {}).theme;
    if (theme === 'light' || theme === 'dark') {
      document.documentElement.setAttribute('data-theme', theme);
    }
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
