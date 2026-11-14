/** @type {import('tailwindcss').Config} */
export default {
<<<<<<< HEAD
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#090B12',
          secondary: '#0E111B',
          tertiary: '#141827',
          elevated: '#191E2D',
        },
        card: {
          DEFAULT: '#1C2233',
          hover: '#22283A',
        },
        primary: {
          DEFAULT: '#8B7CFF',
          hover: '#A58FFF',
          muted: '#6B5FD4',
        },
        success: '#35C9A5',
        text: {
          primary: '#F7F7FC',
          secondary: '#B7BED0',
          muted: '#7E879C',
        },
        border: {
          DEFAULT: '#2A3042',
          subtle: '#1F2535',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        lg: '12px',
        md: '8px',
        sm: '6px',
      },
      boxShadow: {
        card: '0 4px 24px rgba(0,0,0,0.25)',
        glow: '0 0 20px rgba(139,124,255,0.25)',
=======
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Be Vietnam Pro', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        ink: {
          50: '#f7f7f8', 100: '#eeeef1', 200: '#d9d9e0', 300: '#b8b8c5', 400: '#8f8fa3',
          500: '#6e6e85', 600: '#55556b', 700: '#3f3f52', 800: '#26263a', 850: '#1c1c2b', 900: '#14141f', 950: '#0c0c14',
        },
        brand: {
          50: '#eef2ff', 100: '#e0e7ff', 200: '#c7d2fe', 300: '#a5b4fc', 400: '#818cf8',
          500: '#6366f1', 600: '#4f46e5', 700: '#4338ca', 800: '#3730a3', 900: '#312e81',
        },
      },
      boxShadow: {
        panel: '0 1px 2px rgba(16,16,32,.06), 0 8px 24px -12px rgba(16,16,32,.18)',
>>>>>>> origin/master
      },
    },
  },
  plugins: [],
};
