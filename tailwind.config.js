import plugin from 'tailwindcss/plugin';
import { TOKENS, CSS_VARS } from './public/js/utils/design-tokens.js';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './public/**/*.html',
    './public/js/**/*.js',
  ],
  theme: {
    extend: {
      colors: {
        // Semantic tokens (preferred) — see public/js/utils/design-tokens.js
        brand:   TOKENS.brand,
        fg:      TOKENS.fg,
        line:    TOKENS.line,
        surface: TOKENS.surface,
        success: TOKENS.success,
        warning: TOKENS.warning,
        danger:  TOKENS.danger,
        info:    TOKENS.info,
        accent:  TOKENS.accent,
        gold:    TOKENS.gold,

        // Legacy aliases — kept so existing markup keeps working
        primary: {
          DEFAULT: TOKENS.brand.DEFAULT,
          light:   TOKENS.brand.light,
          dark:    TOKENS.brand.strong,
          subtle:  TOKENS.brand.subtle,
        },
        navy: {
          DEFAULT: TOKENS.fg.strong,
          light:   TOKENS.fg.DEFAULT,
          mid:     TOKENS.fg.secondary,
        },
      },
      fontFamily: {
        sans:  ['Noto Sans Thai', 'DM Sans', 'system-ui', 'sans-serif'],
        body:  ['Noto Sans Thai', 'DM Sans', 'system-ui', 'sans-serif'],
        brand: ['Fredoka', 'DM Sans', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 1px 2px rgba(29,54,64,0.04), 0 8px 24px rgba(29,54,64,0.05)',
        'card-hover': '0 16px 36px rgba(42,99,116,0.14)',
        'glow': '0 10px 24px rgba(42,99,116,0.24)',
      },
      borderRadius: {
        'xl2': '1rem',
        'xl3': '1.25rem',
      },
    },
  },
  plugins: [
    // Expose every token as a CSS variable on :root for inline styles and <style> blocks.
    plugin(({ addBase }) => {
      addBase({ ':root': CSS_VARS });
    }),
  ],
};
