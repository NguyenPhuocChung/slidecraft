/** @type {import('tailwindcss').Config} */
export default {
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
      },
    },
  },
  plugins: [],
};
