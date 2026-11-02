/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './public/**/*.html',
    './public/js/**/*.js',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0D9488',
          light:   '#14B8A6',
          dark:    '#0F766E',
          subtle:  '#CCFBF1',
        },
        accent: {
          DEFAULT: '#D4AF37',
          light:   '#EAD26A',
          dark:    '#92751D',
        },
        navy: {
          DEFAULT: '#0F172A',
          light:   '#1E293B',
          mid:     '#334155',
        },
      },
      fontFamily: {
        sans: ['Prompt', 'Sarabun', 'sans-serif'],
        body: ['Sarabun', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 4px 20px rgba(0,0,0,0.04)',
        'card-hover': '0 12px 32px rgba(13,148,136,0.12)',
        'glow': '0 8px 24px rgba(13,148,136,0.25)',
      },
      borderRadius: {
        'xl2': '1rem',
        'xl3': '1.25rem',
      },
    },
  },
  plugins: [],
};
