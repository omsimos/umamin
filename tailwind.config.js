/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./pages/**/*.{js,ts,jsx,tsx}', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        inter: ['Inter', 'sans-serif'],
        syne: ['Syne', 'sans-serif'],
      },
      colors: {
        primary: {
          100: '#F18FDF',
          200: '#DA49BF',
        },
        secondary: {
          100: '#38383C',
          200: '#27272A',
          300: '#16171A',
          400: '#8E8E93',
        },
      },
    },
  },
  plugins: [],
};
