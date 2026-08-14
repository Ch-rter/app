import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Charter palette — deep slate canvas with a restrained teal accent.
        canvas: {
          DEFAULT: '#EEEBE2',
          raised: '#FBFAF6',
          overlay: '#E2DED3',
        },
        // Primary ink. CSS-variable-backed so each root layout owns its value:
        // the dashboard falls back to its light-on-dark text, while the
        // marketing group sets --color-ink to #14171F for dark-on-paper. The
        // fallback channels reproduce the original dashboard hexes exactly
        // (#e6edf3 / #8b98a9 / #5a6675), so omitting the variable — as the
        // dashboard does — renders it identically.
        ink: {
          DEFAULT: 'rgb(var(--color-ink, 20 23 31) / <alpha-value>)',
          muted: 'rgb(var(--color-ink-muted, 76 78 82) / <alpha-value>)',
          faint: 'rgb(var(--color-ink-faint, 112 110 103) / <alpha-value>)',
        },
        accent: {
          DEFAULT: '#D8A93B',
          hover: '#E2B84F',
          muted: '#F0DFB2',
        },
        // Info semantic — for neutral status (pending requests, informational badges)
        info: {
          DEFAULT: '#9A7218',
          muted: '#F0DFB2',
        },
        line: '#14171F',
        danger: '#B8462F',
        warn: '#9A7218',
        ok: '#3F8F5F',
        // Marketing (landing) palette — soft rounded neo-brutalism on light
        // paper. Additive: the dashboard never references these tokens. Gold is
        // the only decorative color; green and red are state-only. The footer
        // is the sole surface that inverts to bg-ink / text-paper.
        paper: '#EEEBE2',
        'paper-raised': '#FBFAF6',
        'ledger-gold': '#D8A93B',
        'signal-green': '#3F8F5F',
        'flag-red': '#B8462F',
      },
      // Custom shadows for depth and glow effects
      boxShadow: {
        'inner-highlight': 'none',
        'glow-accent': 'none',
        'glow-warn': 'none',
        'glow-danger': 'none',
        // Neo-brutalist offset shadows for the marketing surfaces: a hard ink
        // edge with no blur. Hover collapses the 4px offset toward the surface.
        brutal: '4px 4px 0 #14171F',
        'brutal-pressed': '2px 2px 0 #14171F',
      },
      // Marketing surfaces read as physical cards: generous 20px radius, full
      // pills for badges/tags, and a tighter 12px on small chips.
      borderRadius: {
        card: '20px',
        pill: '999px',
        badge: '12px',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
        // Marketing type: display headlines (Space Grotesk 700) and body copy
        // (Inter 400/500). Both resolve per-layout via CSS vars set on the
        // marketing root; they are unset elsewhere, so the dashboard is
        // unaffected. Mono is shared: the marketing root repoints --font-mono
        // at IBM Plex Mono while the dashboard keeps JetBrains Mono.
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        body: ['var(--font-body)', 'system-ui', 'sans-serif'],
      },
      // Semantic stacking order — layers are named by role so nothing reaches
      // for an arbitrary 999. Ascending: base content → sticky chrome →
      // overlays → toasts.
      zIndex: {
        dropdown: '10',
        sticky: '20',
        'modal-backdrop': '30',
        modal: '40',
        toast: '50',
        tooltip: '60',
      },
    },
  },
  plugins: [],
};

export default config;
