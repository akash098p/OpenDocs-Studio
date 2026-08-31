/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c3d66',
        },
        goldenrod: {
          DEFAULT: '#daa520',
          50: '#fdf9ec',
          100: '#fbf0c8',
          200: '#f6e29a',
          300: '#f0d066',
          400: '#ebbe3d',
          500: '#daa520',
          600: '#b8860b',
          700: '#8b6508',
          800: '#5e4506',
          900: '#3a2a03',
        },
      },
      spacing: {
        'sidebar': '280px',
      },
    },
  },
  plugins: [],
}
