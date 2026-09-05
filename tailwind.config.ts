import type { Config } from 'tailwindcss';

// Every color is a CSS variable holding space-separated RGB channels, wrapped
// in rgb(var(--x) / <alpha-value>) so opacity modifiers (bg-surface/60) still
// work. The variables are defined once in app/globals.css and flipped there
// for dark mode -- that is the only place light vs dark is decided, so no
// component ever branches on theme.
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'rgb(var(--bg) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        'surface-2': 'rgb(var(--surface-2) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        'line-strong': 'rgb(var(--line-strong) / <alpha-value>)',

        text: 'rgb(var(--text) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        dim: 'rgb(var(--dim) / <alpha-value>)',

        // Each status color comes in three strengths:
        //   base    -- fills, bars, dots (not text on a light wash)
        //   -ink    -- the same hue pushed to text strength, for a label
        //              sitting on a 10-15% wash of its own color
        //   on-     -- text/icons on top of a SOLID fill of the base
        accent: 'rgb(var(--accent) / <alpha-value>)',
        'accent-ink': 'rgb(var(--accent-ink) / <alpha-value>)',
        'on-accent': 'rgb(var(--on-accent) / <alpha-value>)',

        ok: 'rgb(var(--ok) / <alpha-value>)',
        'ok-ink': 'rgb(var(--ok-ink) / <alpha-value>)',
        'on-ok': 'rgb(var(--on-ok) / <alpha-value>)',

        warn: 'rgb(var(--warn) / <alpha-value>)',
        'warn-ink': 'rgb(var(--warn-ink) / <alpha-value>)',
        'on-warn': 'rgb(var(--on-warn) / <alpha-value>)',

        danger: 'rgb(var(--danger) / <alpha-value>)',
        'danger-ink': 'rgb(var(--danger-ink) / <alpha-value>)',
        'on-danger': 'rgb(var(--on-danger) / <alpha-value>)',
      },
      fontFamily: {
        sans: [
          'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto',
          'Helvetica Neue', 'Arial', 'sans-serif',
        ],
        // Machine values only: money, points, dates, last-4s, percentages.
        mono: [
          'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas',
          'Liberation Mono', 'monospace',
        ],
      },
      borderRadius: { xl: '0.75rem', '2xl': '1rem', '3xl': '1.5rem' },
      letterSpacing: {
        // Small uppercase labels need opening up; big numerals need closing in.
        label: '0.14em',
        tighter: '-0.03em',
      },
      boxShadow: {
        // The accent used as light rather than as fill.
        glow: '0 0 0 1px rgb(var(--accent) / 0.25), 0 0 28px -6px rgb(var(--accent) / 0.45)',
        panel: '0 1px 0 0 rgb(var(--line) / 0.6)',
      },
    },
  },
  plugins: [],
};

export default config;
