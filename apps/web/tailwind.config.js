/* eslint-disable global-require */
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./pages/**/*.{js,ts,jsx,tsx}', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        inter: ['Inter', 'sans-serif'],
        syne: ['Syne', 'sans-serif'],
        interMedium: ['Inter-Medium', 'sans-serif'],
        syneExtrabold: ['Syne-Extrabold', 'sans-serif'],
      },
      colors: {
        primary: {
          100: '#FF84D6',
          200: '#FF59C7',
        },
        secondary: {
          100: '#2D2E34',
          200: '#1C1D21',
          300: '#151618',
          400: '#8E8E93',
        },
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
