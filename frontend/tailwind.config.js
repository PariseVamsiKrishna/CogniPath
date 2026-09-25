/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        heading: ['"Space Grotesk"', 'sans-serif'],
        sans: ['"Inter"', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'journey-card': '0 18px 34px -18px rgba(0,0,0,0.55)',
        'journey-card-hover': '0 24px 44px -16px rgba(0,0,0,0.75)',
        'glow-mint': '0 0 12px rgba(95, 227, 176, 0.45)',
        'glow-violet': '0 0 16px rgba(139, 124, 255, 0.35)',
        'glow-amber': '0 0 14px rgba(255, 193, 94, 0.4)',
        'glow-pink': '0 0 14px rgba(255, 111, 156, 0.4)',
      },
      colors: {
        journey: {
          bg: '#0A0D1C',
          panel: '#12162B',
          secondary: '#171C36',
          border: '#262C4C',
          primary: '#ECEDF7',
          muted: '#8A90B4',
          violet: '#8B7CFF',
          pink: '#FF6F9C',
          mint: '#5FE3B0',
          amber: '#FFC15E',
        },
        brand: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
        },
        cogni: {
          blue: '#1e40af',
          indigo: '#4338ca',
          cyan: '#0891b2',
          purple: '#7e22ce',
          dark: '#0f172a',
          card: '#1e293b'
        },
        darktheme: {
          bg: '#0b0f19',
          card: '#121826',
          cardHover: '#161f32',
          border: '#1e2638',
          pill: '#1e1e38',
          purple: '#6366f1',
          blue: '#3b82f6',
          emerald: '#10b981',
          amber: '#f59e0b'
        }
      }
    },
  },
  plugins: [],
}
