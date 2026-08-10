import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#000510',
          900: '#0a1224',
          800: '#0f1a2e',
          700: '#15233d',
          600: '#1c2c4a',
          500: '#293a5c',
        },
        link: '#60cdff',
        accent: {
          red: '#e3000f',
          blue: '#0070ba',
          green: '#1fdf6c',
          mint: '#3ccea0',
        },
      },
      fontFamily: {
        sans: [
          'Plain',
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro Text',
          'Segoe UI',
          'system-ui',
          'sans-serif',
        ],
        display: [
          'PayPal Pro',
          'Plain',
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro Display',
          'Segoe UI',
          'system-ui',
          'sans-serif',
        ],
        text: [
          'Plain',
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro Text',
          'Segoe UI',
          'system-ui',
          'sans-serif',
        ],
      },
      boxShadow: {
        phone:
          '0 50px 100px -20px rgba(0,0,0,0.35), 0 30px 60px -30px rgba(0,0,0,0.5), inset 0 0 0 2px rgba(255,255,255,0.06)',
      },
    },
  },
  plugins: [],
} satisfies Config
