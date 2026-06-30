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
        // so partner colors flow through utility classes like bg-brand.
        brand: 'var(--brand-primary)',
        'brand-hover': 'var(--brand-primary-hover)',
        'on-brand': 'var(--brand-on-primary)',
        accent: 'var(--brand-accent)',
        primary: {
          400: '#ABD037', // Movaia default green
          500: '#98B830',
          600: '#7a9326',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Outfit', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        scaleIn: { '0%': { transform: 'scale(0.95)', opacity: '0' }, '100%': { transform: 'scale(1)', opacity: '1' } },
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
};
