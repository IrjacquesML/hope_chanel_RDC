/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#0B3C7A', dark: '#082C5A', light: '#1E5BA8' },
        accent: { DEFAULT: '#F59E0B', dark: '#D97706' },
        mist: '#F3F4F6',
        ink: '#111827',
      },
      fontFamily: {
        heading: ['Poppins', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        fadeIn: { from: { opacity: 0, transform: 'translateY(-4px)' }, to: { opacity: 1, transform: 'none' } },
      },
      animation: { 'fade-in': 'fadeIn .18s ease-out' },
    },
  },
  plugins: [],
};
