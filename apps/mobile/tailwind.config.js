/* eslint-disable global-require */
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.{js,ts,jsx,tsx}', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
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
