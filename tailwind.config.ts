import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      colors: {
        bg: {
          primary: '#0a0a0f',
          secondary: '#12121a',
          card: '#1a1a27',
        },
        accent: {
          purple: '#7c3aed',
          blue: '#3b82f6',
          green: '#10b981',
          amber: '#f59e0b',
          red: '#ef4444',
        },
      },
      borderRadius: {
        xl: '12px',
        '2xl': '16px',
        '3xl': '20px',
      },
      screens: {
        // Mobile-first — no desktop breakpoints needed
        sm: '375px',
        md: '430px',
      },
    },
  },
  plugins: [],
}

export default config
