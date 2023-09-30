/* eslint-disable global-require */
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./pages/**/*.{js,ts,jsx,tsx}', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        inter: ['Inter', 'sans-serif'],
        syne: ['Syne', 'sans-serif'],
        interMedium: ['Inter-Medium', 'sans-serif'],
        syneExtrabold: ['Syne-Extrabold', 'sans-serif'],
        galyonBold: ['Galyon-Bold', 'sans-serif'],
      },
      colors: {
        primary: {
          100: '#FF59C7',
          200: '#FF00A9',
          300: '#D149A4',
        },
        secondary: {
          100: '#2D2E34',
          200: '#1C1D21',
          300: '#151618',
          400: '#8E8E93',
        },
        dcblue: '#5865f2',
        tigris: '#FF6F07'
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
