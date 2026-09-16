import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // Sprout Media brand — ink (near-black, sampled from the logo
        // wordmark) as the primary/chrome color, gold (sampled from the
        // logo's circle) as the single accent used sparingly for emphasis.
        brand: {
          50: '#f5f4f5',
          100: '#e7e5e8',
          200: '#c9c5cb',
          300: '#a29ca6',
          400: '#726b77',
          500: '#4a4450',
          600: '#332e37',
          700: '#28232a',
          800: '#1d1a1f',
          900: '#141216'
        },
        gold: {
          50: '#fffceb',
          100: '#fff6c2',
          200: '#ffec85',
          300: '#ffdd47',
          400: '#fed31a',
          500: '#fece00',
          600: '#d9a900',
          700: '#ad7f00',
          800: '#8a6300',
          900: '#6b4c00'
        },
        // Second chart series — "money actually collected". Validated against
        // gold-600 for colour-vision separation (see dataviz palette check).
        sprout: {
          50: '#eefbf3',
          500: '#2f8f5b',
          600: '#26754a'
        }
      },
      boxShadow: {
        soft: '0 1px 2px rgba(20,18,22,.04), 0 4px 16px -6px rgba(20,18,22,.08)',
        lift: '0 2px 4px rgba(20,18,22,.05), 0 12px 28px -10px rgba(20,18,22,.16)'
      },
      keyframes: {
        shimmer: {
          '0%': { opacity: '1' },
          '50%': { opacity: '.45' },
          '100%': { opacity: '1' }
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' }
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' }
        },
        popIn: {
          from: { opacity: '0', transform: 'translateY(6px) scale(.98)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' }
        },
        growUp: {
          from: { transform: 'scaleY(0)' },
          to: { transform: 'scaleY(1)' }
        }
      },
      animation: {
        shimmer: 'shimmer 1.6s ease-in-out infinite',
        'slide-up': 'slideUp .22s ease-out',
        'fade-in': 'fadeIn .25s ease-out',
        'pop-in': 'popIn .18s ease-out',
        'grow-up': 'growUp .5s cubic-bezier(.2,.8,.3,1) both'
      }
    }
  },
  plugins: []
};

export default config;
