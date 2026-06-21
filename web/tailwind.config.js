/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { 50: 'var(--primary-50)', 100: 'var(--primary-100)', 500: 'var(--primary-500)', 600: 'var(--primary-600)', 700: 'var(--primary-700)', DEFAULT: 'var(--primary-600)' },
        ai: { 50: 'var(--ai-50)', soft: 'var(--ai-soft)', 500: 'var(--ai-500)', 600: 'var(--ai-600)', 700: 'var(--ai-700)', DEFAULT: 'var(--ai-600)' },
        success: { DEFAULT: 'var(--success)', soft: 'var(--success-soft)', text: 'var(--success-text)' },
        warning: { DEFAULT: 'var(--warning)', soft: 'var(--warning-soft)', text: 'var(--warning-text)' },
        danger: { DEFAULT: 'var(--danger)', soft: 'var(--danger-soft)', text: 'var(--danger-text)' },
        info: { DEFAULT: 'var(--info)', soft: 'var(--info-soft)', text: 'var(--info-text)' },
      },
      fontFamily: {
        sans: ['IBM Plex Sans', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'ui-monospace', 'monospace'],
      },
      borderRadius: { lg: '10px', xl: '14px' },
      boxShadow: { sm: 'var(--shadow-sm)', md: 'var(--shadow-md)', lg: 'var(--shadow-lg)' },
    },
  },
  plugins: [],
};
