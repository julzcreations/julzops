import type { Config } from 'tailwindcss'

// Theme tokens mirror SubTracker's cozy pink/purple lo-fi palette.
// Keep these in sync across julzcreations.com properties.
const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-rounded', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Georgia', 'serif'],
      },
      colors: {
        pink: {
          50: '#fff0f7',
          100: '#ffe4f0',
          200: '#ffc4d8',
          300: '#ffb7c5',
          400: '#ff8fab',
          500: '#ff6b8a',
          600: '#e8496b',
          700: '#c73054',
          800: '#a01f41',
          900: '#7a1530',
          950: '#4a0a1c',
        },
        purple: {
          50: '#f9f5ff',
          100: '#f0ebff',
          200: '#ddd6fe',
          300: '#c8a2c8',
          400: '#b388eb',
          500: '#a78bfa',
          600: '#8b5cf6',
          700: '#7c3aed',
          800: '#5b21b6',
          900: '#4c1d95',
          950: '#2e1065',
        },
        amber: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
          950: '#451a03',
        },
        lavender: {
          50: '#f7f5ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
          950: '#2e1065',
        },
      },
      backgroundImage: {
        'gradient-lofi': 'linear-gradient(135deg, #fff0f7 0%, #f5f0ff 50%, #ede9fe 100%)',
      },
      boxShadow: {
        'pink-glow': '0 4px 20px rgba(255, 183, 197, 0.4)',
        'purple-glow': '0 4px 20px rgba(167, 139, 250, 0.3)',
        'amber-glow': '0 4px 20px rgba(251, 191, 36, 0.25)',
        card: '0 4px 24px rgba(255, 183, 197, 0.25)',
        'card-hover': '0 8px 32px rgba(167, 139, 250, 0.2)',
      },
    },
  },
  plugins: [],
}

export default config
