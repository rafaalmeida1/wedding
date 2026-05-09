import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // Paleta rose gold da spec § 11.3
        rose: {
          50: '#FFF1F5',
          100: '#FCE4EC',
          200: '#F8BBD9',
          300: '#F299C2',
          400: '#E76FA0',
          500: '#D5497F',
          600: '#C2185B',
          700: '#9C124A',
          800: '#770D38',
          900: '#54082A',
        },
        ink: {
          DEFAULT: '#1F1B24',
          soft: '#3A323F',
          mute: '#6E6577',
        },
        cream: '#FBF7F4',
      },
      fontFamily: {
        serif: ['var(--font-playfair)', 'serif'],
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'rose-gold-gradient':
          'linear-gradient(135deg, #FCE4EC 0%, #F8BBD9 50%, #C2185B 100%)',
      },
      boxShadow: {
        soft: '0 10px 40px -20px rgba(194, 24, 91, 0.35)',
        bloom: '0 20px 60px -20px rgba(194, 24, 91, 0.45)',
      },
      keyframes: {
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in-up': 'fade-in-up 400ms ease-out both',
      },
    },
  },
  plugins: [],
};

export default config;
