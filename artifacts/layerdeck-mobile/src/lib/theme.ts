// Pulled directly from the live web app's CSS custom properties, not
// reinterpreted. Dark, navy-based, gold-accented control-panel aesthetic.

export const colors = {
  // Backgrounds (layered: bg -> card -> surface2 -> surface3, each a step
  // more "elevated"/hovered)
  bg: '#0F0F1A',
  card: '#1A1A2E',
  surface2: '#20203C',
  surface3: '#26264A',
  navBg: '#0C0C18', // tab bar / header, darker than base bg
  border: '#2A2840',
  borderStrong: '#383658',

  // Gold — brand identity, active/selected states, primary numbers
  accent: '#C9A84C',
  accentBright: '#D4AF37',
  accentDim: '#6B5A28',
  accentDark: '#1A1408', // background tint for gold badges
  accentGlow: 'rgba(201,168,76,0.15)',
  accentMuted: '#6B5A28',

  text: '#E8E8F0',
  textMuted: '#9090A8',
  textBright: '#FFFFFF',

  // Semantic aliases used throughout existing screens
  danger: '#ef4444',
  success: '#10b981',
  warning: '#f97316',
  silver: '#c4c9d1',
};

// Full status/accent palette: base for text/icons, "B" for emphasis, "D"
// as a low-opacity-style dark tint for badge backgrounds (pattern: base
// text on a "D" background, not solid fills).
export const palette = {
  purple: { base: '#8b5cf6', b: '#a78bfa', d: '#1e1040' },
  orange: { base: '#f97316', b: '#fb923c', d: '#1e0d00' },
  green: { base: '#10b981', b: '#34d399', d: '#022318' },
  red: { base: '#ef4444', b: '#f87171', d: '#200808' },
  teal: { base: '#14b8a6', b: '#5eead4', d: '#021c18' },
  cyan: { base: '#38bdf8', b: '#38bdf8', d: '#062030' },
  pink: { base: '#ec4899', b: '#ec4899', d: '#2d0520' },
  shopify: { base: '#96bf48', b: '#96bf48', d: '#142008' },
  gold: { base: '#C9A84C', b: '#D4AF37', d: '#1A1408' },
};

// Semantic mapping, not just hex — carry the meaning, not just the color:
// gold = brand/active, green = success/done/healthy/low-fail,
// red = critical/failed/depleted/high-fail, orange = warning/low,
// cyan = info/sync, purple = print groups/organizational badges,
// shopify green = Shopify-sourced badges only.
export const statusColors: Record<string, string> = {
  critical: palette.red.base,
  low: palette.orange.base,
  ok: palette.cyan.base,
  full: palette.green.base,
};

// Badge style helper: base-color text on that color's low-opacity "D" tint
// background — the consistent badge pattern used throughout the web app.
export function badgeStyle(base: string, dark: string) {
  return { color: base, backgroundColor: dark };
}

export const fonts = {
  body: 'PlusJakartaSans_400Regular',
  bodyMedium: 'PlusJakartaSans_600SemiBold',
  bodyBold: 'PlusJakartaSans_700Bold',
  display: 'Orbitron_700Bold', // stat numbers, section headers, logo wordmark
  displayBlack: 'Orbitron_900Black',
  mono: 'ShareTechMono_400Regular',
};
