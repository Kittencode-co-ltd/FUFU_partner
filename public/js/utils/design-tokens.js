/**
 * FUFU Partner design tokens — single source of truth for colors.
 *
 * Consumed by:
 *   - tailwind.config.js  → Tailwind classes (bg-brand, text-fg-muted, border-line, bg-danger-subtle …)
 *                           and :root CSS variables (--color-brand, --color-fg-muted …)
 *   - runtime JS modules  → `import { COLOR } from '../utils/design-tokens.js'` when a hex string
 *                           is needed in JS (e.g. alpha concatenation `${COLOR.brand}22`).
 *
 * In inline styles / <style> blocks rendered inside the dashboard, prefer the CSS variable
 * with a hex fallback: `color:var(--color-brand,#2A6374)`.
 * Print windows (window.open + document.write) do NOT load main.css — keep literal hex there.
 *
 * Scale convention per semantic group:
 *   DEFAULT  solid colour (icons, fills, buttons)
 *   strong   darker shade for text on subtle backgrounds / hover
 *   subtle   tinted background (badges, alerts)
 *   faint    very light background (rows, panels)
 */
export const TOKENS = {
  // Brand colours come from the FUFU logo (App Assets/Logo/FUFU Logo.png) and match
  // the landing page variables in app/globals.css.
  brand: {
    DEFAULT: '#2A6374', // logo "FUFU" teal
    strong:  '#1B414B',
    light:   '#3A8296',
    muted:   '#A7D9D3',
    subtle:  '#D7EEEB',
    faint:   '#ECF7F5', // logo mint wash
  },
  fg: {
    DEFAULT:   '#1D3640',
    strong:    '#142A32',
    secondary: '#34515B',
    tertiary:  '#4A6670',
    muted:     '#5E7379',
    subtle:    '#93A5AA',
    inverse:   '#FFFFFF',
  },
  line: {
    DEFAULT: '#E4EAE9',
    strong:  '#CFD9D8',
  },
  surface: {
    DEFAULT: '#FFFFFF',
    muted:   '#FAF7F2', // warm cream page background
    sunken:  '#F1F4F3',
  },
  success: {
    DEFAULT: '#2F9E7A',
    strong:  '#1E6B52',
    subtle:  '#D9F2E8',
    faint:   '#EFF9F4',
  },
  warning: {
    DEFAULT: '#E3A43B',
    strong:  '#8A5A12',
    subtle:  '#FBEBCB',
    faint:   '#FEF7EA',
  },
  danger: {
    DEFAULT: '#E2554B',
    hover:   '#C9433A',
    strong:  '#8F2A24',
    subtle:  '#FBDEDB',
    faint:   '#FDF1F0',
  },
  info: {
    DEFAULT: '#3B82C4',
    strong:  '#1F4F7E',
    subtle:  '#DCEAF7',
    faint:   '#F0F6FC',
  },
  accent: {
    DEFAULT: '#F0865E', // logo "Pet Care" coral
    light:   '#F7C2AB',
    dark:    '#C25A33',
    faint:   '#FDF0EA',
  },
  gold: {
    DEFAULT: '#F3D6AA', // mascot fur
    dark:    '#B98A45',
  },
};

/** Flat map: COLOR.brand, COLOR['brand-strong'], COLOR['fg-muted'] … */
export const COLOR = Object.fromEntries(
  Object.entries(TOKENS).flatMap(([group, shades]) =>
    Object.entries(shades).map(([shade, hex]) => [
      shade === 'DEFAULT' ? group : `${group}-${shade}`,
      hex,
    ]),
  ),
);

/** CSS custom properties: { '--color-brand': '#2A6374', … } */
export const CSS_VARS = Object.fromEntries(
  Object.entries(COLOR).map(([name, hex]) => [`--color-${name}`, hex]),
);
