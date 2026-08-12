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
          DEFAULT: '#0b0f14',
          raised: '#111823',
          overlay: '#1a2534',
        },
        // Primary ink. CSS-variable-backed so each root layout owns its value:
        // the dashboard falls back to its light-on-dark text, while the
        // marketing group sets --color-ink to #14171F for dark-on-paper. The
        // fallback channels reproduce the original dashboard hexes exactly
        // (#e6edf3 / #8b98a9 / #5a6675), so omitting the variable — as the
        // dashboard does — renders it identically.
        ink: {
          DEFAULT: 'rgb(var(--color-ink, 230 237 243) / <alpha-value>)',
          muted: 'rgb(var(--color-ink-muted, 139 152 169) / <alpha-value>)',
          faint: 'rgb(var(--color-ink-faint, 90 102 117) / <alpha-value>)',
        },
        accent: {
          DEFAULT: '#2dd4bf',
          hover: '#5eead4',
          muted: '#134e4a',
        },
        // Info semantic — for neutral status (pending requests, informational badges)
        info: {
          DEFAULT: '#60a5fa',
          muted: '#1e3a5f',
        },
        line: '#1e2a3a',
        danger: '#f87171',
        warn: '#fbbf24',
        ok: '#34d399',
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
        'inner-highlight': 'inset 0 1px 0 rgba(255, 255, 255, 0.03)',
        'glow-accent': '0 0 12px rgba(45, 212, 191, 0.2)',
        'glow-warn': '0 0 8px rgba(251, 191, 36, 0.4)',
        'glow-danger': '0 0 12px rgba(248, 113, 113, 0.15)',
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
