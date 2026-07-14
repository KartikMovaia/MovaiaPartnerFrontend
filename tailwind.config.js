/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    './shared/**/*.{js,ts,jsx,tsx}',
    './apps/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Brand tokens read from CSS custom properties set by PartnerThemeProvider,
        // so partner colors flow through utility classes like bg-brand. On the
        // kiosk these become the partner's white-label color; elsewhere they are
        // Movaia's own green.
        brand: 'var(--brand-primary)',
        'brand-hover': 'var(--brand-primary-hover)',
        'on-brand': 'var(--brand-on-primary)',
        accent: 'var(--brand-accent)',
        // Movaia house green (design: #ABD037 primary, used on Movaia-owned chrome).
        movaia: {
          DEFAULT: '#ABD037',
          400: '#ABD037',
          500: '#98B830',
          600: '#7a9326',
          ink: '#1c2b00', // readable text on the green
          text: '#5a7d16', // green text on light-green surfaces
        },
        ink: '#000000', // design body text
        muted: '#686868', // design muted / labels / borders
        // Status palette (design pill: bg / text / dot).
        status: {
          doneBg: '#eef6dd',
          doneText: '#5a7d16',
          doneDot: '#7fb015',
          procBg: '#fdf0d9',
          procText: '#a9720d',
          procDot: '#e0930f',
          failBg: '#fce7e6',
          failText: '#b23a34',
          failDot: '#d64a43',
        },
        // Neutral canvas tones used across admin surfaces.
        canvas: '#f7f7f5',
        panel: '#141414',
        primary: {
          400: '#ABD037',
          500: '#98B830',
          600: '#7a9326',
        },
      },
      fontFamily: {
        // Montserrat is the brand primary (display, body, UI, numbers);
        // Jost stands in for Nexa on uppercase accents.
        sans: ['Montserrat', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Montserrat', 'system-ui', 'sans-serif'],
        accent: ['Jost', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        // Ported from the design prototype's @keyframes.
        'mv-spin': 'mv-spin 1.1s linear infinite',
        'mv-pulse': 'mv-pulse 1s ease-in-out infinite',
        'mv-bar': 'mv-bar 1.4s ease-in-out infinite',
        'mv-ring': 'mv-ring 1.6s ease-out infinite',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        scaleIn: { '0%': { transform: 'scale(0.95)', opacity: '0' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        'mv-spin': { to: { transform: 'rotate(360deg)' } },
        'mv-pulse': { '0%,100%': { opacity: '1' }, '50%': { opacity: '.35' } },
        'mv-bar': { '0%': { transform: 'translateX(-100%)' }, '100%': { transform: 'translateX(100%)' } },
        'mv-ring': { '0%': { transform: 'scale(.6)', opacity: '.9' }, '100%': { transform: 'scale(1.9)', opacity: '0' } },
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
};
