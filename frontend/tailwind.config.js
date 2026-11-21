/** @type {import('tailwindcss').Config} */
import colors from 'tailwindcss/colors';

// ---------------------------------------------------------------------------
// SunPower "Storia" theme
// The design template is monochrome (black / white / #808080) with a deep navy
// brand colour (#1B3E5E, the logo colour). Instead of rewriting every page, the
// palette families used across the app are remapped here, so all screens pick up
// the new scheme while their markup and behaviour stay exactly the same.
//   amber  (old primary)    -> brand navy
//   slate  (old greys)      -> neutral greys
//   indigo / purple         -> ink / steel (monochrome accents)
//   blue / cyan / teal / sky-> brand navy tints
//   emerald / rose          -> kept for success / danger meaning (slightly muted)
// ---------------------------------------------------------------------------
const brand = {
  50: '#f2f5f8',
  100: '#e3e9f0',
  200: '#c5d2df',
  300: '#94aac0',
  400: '#5a7895',
  500: '#1B3E5E',
  600: '#163450',
  700: '#122b42',
  800: '#0e2234',
  900: '#0a1826',
  950: '#050d15',
};

const ink = {
  50: '#f6f6f6',
  100: '#ececec',
  200: '#d9d9d9',
  300: '#b3b3b3',
  400: '#808080',
  500: '#404040',
  600: '#262626',
  700: '#171717',
  800: '#111111',
  900: '#0a0a0a',
  950: '#000000',
};

const steel = {
  50: '#f4f6f8',
  100: '#e6eaef',
  200: '#cdd5de',
  300: '#a5b2c1',
  400: '#74869b',
  500: '#4f6176',
  600: '#3d4c5e',
  700: '#2f3b4a',
  800: '#222b37',
  900: '#161c24',
  950: '#0b0f14',
};

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
      },
      fontWeight: {
        // template headings are medium weight with tight tracking – soften the heavy weights
        bold: '600',
        extrabold: '600',
        black: '700',
      },
      colors: {
        brand,
        ink,
        steel,
        amber: brand,
        solar: brand,
        slate: colors.neutral,
        gray: colors.neutral,
        indigo: ink,
        purple: steel,
        violet: steel,
        blue: brand,
        sky: brand,
        cyan: brand,
        teal: brand,
        navy: { 800: '#0e2234', 900: '#0a1826' },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};
