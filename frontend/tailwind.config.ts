import type { Config } from 'tailwindcss';

const v = (name: string) => `hsl(var(--${name}) / <alpha-value>)`;

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: v('bg'),
        surface: v('surface'),
        sunken: v('sunken'),
        ink: v('ink'),
        muted: v('muted'),
        line: v('line'),
        leaf: { DEFAULT: v('leaf'), soft: v('leaf-soft'), ink: v('leaf-ink') },
        water: { DEFAULT: v('water'), soft: v('water-soft') },
        amber: { DEFAULT: v('amber') },
        danger: { DEFAULT: v('danger'), soft: v('danger-soft') },
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['Figtree', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'sans-serif'],
      },
      borderRadius: { xl: '14px', '2xl': '20px', '3xl': '28px' },
      keyframes: {
        'ring-in': { from: { strokeDashoffset: 'var(--ring-from)' }, to: { strokeDashoffset: 'var(--ring-to)' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: { shimmer: 'shimmer 1.4s infinite' },
    },
  },
  plugins: [],
} satisfies Config;
