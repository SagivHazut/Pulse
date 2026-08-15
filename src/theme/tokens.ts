/** Shared design tokens. Themes swap colour; these stay constant. */

export const SPACING = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const RADIUS = {
  tile: 7,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  pill: 999,
} as const;

export const FONT_SIZE = {
  micro: 11,
  caption: 13,
  body: 15,
  label: 17,
  title: 22,
  heading: 30,
  display: 44,
  hero: 58,
} as const;

export const FONT_WEIGHT = {
  regular: '500',
  medium: '600',
  bold: '700',
  heavy: '800',
} as const;

/** Minimum touch target, per platform accessibility guidance. */
export const HIT_SLOP = { top: 10, bottom: 10, left: 10, right: 10 } as const;
export const MIN_TAP_TARGET = 44;

export const ELEVATION = {
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  tile: {
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  dragging: {
    shadowColor: '#000',
    shadowOpacity: 0.42,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 14 },
    elevation: 18,
  },
} as const;
