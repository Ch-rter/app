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
        ink: {
          DEFAULT: '#e6edf3',
          muted: '#8b98a9',
          faint: '#5a6675',
        },
        accent: {
          DEFAULT: '#2dd4bf',
          hover: '#5eead4',
          muted: '#134e4a',
        },
        line: '#1e2a3a',
        danger: '#f87171',
        warn: '#fbbf24',
        ok: '#34d399',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
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
