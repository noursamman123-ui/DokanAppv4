/**
 * Dokan App – Color System
 * Brand colors sampled directly from the real Dokan logo (blue cart/"د" mark
 * + orange "دكان" wordmark — see src/assets/images/logo.png) rather than the
 * earlier amber/plum palette, which didn't match the logo at all. `secondary`
 * is a darkened derivative of the logo's own blue hue (not a re-sampled
 * value) so it keeps the exact same hue family while being dark enough for
 * white text on top — the logo blue itself (#3795D2) is only ~3.3:1 against
 * white, well under WCAG AA's 4.5:1 for normal text.
 */

export const Colors = {
  // ─── Brand ────────────────────────────────────────────────────────────────
  primary: '#EE7E00',        // Logo orange (sampled from src/assets/images/logo.png)
  primaryDark: '#AD5C00',    // Accessible variant for text/icons on light surfaces (AA, ~4.9:1 on white)
  primaryLight: '#FADBB8',
  primarySurface: '#FEF5EB',

  // ─── Secondary ────────────────────────────────────────────────────────────
  secondary: '#0D293A',      // Darkened logo blue — same hue as brandBlue, ~15:1 on white
  secondaryLight: '#1C577D',

  // Exact logo blue (#3795D2) — for accents/icons/links where the true
  // brand blue should show, as opposed to `secondary`'s darkened variant.
  brandBlue: '#3795D2',

  // ─── UI Backgrounds ───────────────────────────────────────────────────────
  background: '#FBF7F0',
  surface: '#FFFFFF',
  surfaceSecondary: '#F5F1E8',
  card: '#FFFFFF',

  // ─── Text ─────────────────────────────────────────────────────────────────
  textPrimary: '#221D18',
  textSecondary: '#6B6259',
  textTertiary: '#8C8375',
  textInverse: '#FFFFFF',
  textOnPrimary: '#FFFFFF',

  // ─── Semantic ─────────────────────────────────────────────────────────────
  success: '#27AE60',
  successLight: '#E8F8F0',
  error: '#E74C3C',
  errorLight: '#FDECEB',
  warning: '#F39C12',
  warningLight: '#FEF9E7',
  info: '#2980B9',
  infoLight: '#EBF5FB',

  // ─── Discount / Sale ──────────────────────────────────────────────────────
  sale: '#E74C3C',
  saleBg: '#FDECEB',

  // ─── Rating ───────────────────────────────────────────────────────────────
  rating: '#EE7E00',

  // ─── Borders & Dividers ───────────────────────────────────────────────────
  border: '#E3D8C4',
  borderLight: '#EEE7D8',
  divider: '#EAE2D2',

  // ─── Overlay ──────────────────────────────────────────────────────────────
  overlay: 'rgba(0,0,0,0.5)',
  overlayLight: 'rgba(0,0,0,0.15)',
  overlayWhite: 'rgba(255,255,255,0.9)',

  // ─── Input ────────────────────────────────────────────────────────────────
  inputBackground: '#F5F1E8',
  inputBorder: '#DDD2BC',
  inputFocusBorder: '#EE7E00',
  // Was #B0A692 (~2.3:1 against inputBackground — well under WCAG AA's 4.5:1
  // for normal text). Matches textSecondary's value, which already clears
  // AA (~5.5:1) — reusing it keeps placeholders legible without introducing
  // a one-off hex value.
  placeholder: '#6B6259',

  // ─── Skeleton ─────────────────────────────────────────────────────────────
  skeletonBase: '#E5DCC9',
  skeletonHighlight: '#F5F1E8',

  // ─── Navigation ───────────────────────────────────────────────────────────
  tabActive: '#EE7E00',
  tabInactive: '#B0A692',
  navBackground: '#FFFFFF',

  // ─── Transparent ──────────────────────────────────────────────────────────
  transparent: 'transparent',
} as const;

export type ColorKeys = keyof typeof Colors;
