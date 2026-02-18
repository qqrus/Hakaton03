/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ocean: {
          50: '#f0f7ff',
          100: '#c7dff4',
          200: '#89b8de',
          300: '#4f8bbf',
          400: '#2d6d9e',
          500: '#1a5a85',
          600: '#134a6e',
          700: '#0e3a58',
          800: '#0a2940',
          900: '#061c2e',
        },
        sand: {
          50: '#fefdfb',
          100: '#f5f0e5',
          200: '#e6dec8',
          300: '#d6c6a5',
          400: '#c5ab81',
          500: '#b69262',
          600: '#a47c50',
        },
        jungle: {
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
        },
        parchment: {
          50: '#f9f7f2',
          100: '#f2eee3',
          200: '#e6dec8',
          300: '#d6c6a5',
          400: '#c5ab81',
          500: '#b69262',
          600: '#a47c50',
          700: '#876342',
          800: '#70523a',
          900: '#5c4533',
        },
        ink: {
          900: '#1a1510',
          800: '#2c241b',
          700: '#4a3f33',
        },
      },
      fontFamily: {
        serif: ['"Merriweather"', '"Cinzel"', 'serif'],
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}