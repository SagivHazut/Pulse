import type { BlockColorId } from '../types';

export type ThemeColors = {
  background: string;
  backgroundAlt: string;
  surface: string;
  surfaceSecondary: string;
  surfaceElevated: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentSoft: string;
  accentContrast: string;
  danger: string;
  dangerSoft: string;
  success: string;
  warning: string;
  boardBackground: string;
  gridCell: string;
  gridLine: string;
  ghostValid: string;
  ghostInvalid: string;
  overlay: string;
  coin: string;
};

export type BlockSkin = { base: string; light: string; dark: string; glow: string };
export type BlockPalette = Record<BlockColorId, BlockSkin>;

export type Theme = {
  id: string;
  name: string;
  tagline: string;
  mode: 'dark' | 'light';
  /** Coin cost. 0 means free. */
  price: number;
  /** Player level required before it can be bought. */
  unlockLevel: number;
  colors: ThemeColors;
  blocks: BlockPalette;
  /** Backdrop gradient, top to bottom. */
  backdrop: [string, string, string];
  /** Colours used by particle bursts. */
  particles: string[];
};

function skin(base: string, light: string, dark: string, glow: string): BlockSkin {
  return { base, light, dark, glow };
}

// ------------------------------------------------------------------- neon

const NEON: Theme = {
  id: 'neon',
  name: 'Neon',
  tagline: 'Deep space, electric edges',
  mode: 'dark',
  price: 0,
  unlockLevel: 1,
  colors: {
    background: '#0A0C17',
    backgroundAlt: '#111531',
    surface: '#171B32',
    surfaceSecondary: '#1F2444',
    surfaceElevated: '#282E58',
    textPrimary: '#F3F5FF',
    textSecondary: '#A9AFCE',
    textMuted: '#6B7296',
    accent: '#5EE7DF',
    accentSoft: 'rgba(94,231,223,0.16)',
    accentContrast: '#04121A',
    danger: '#FF5C7A',
    dangerSoft: 'rgba(255,92,122,0.18)',
    success: '#5CE49B',
    warning: '#FFC15E',
    boardBackground: '#101428',
    gridCell: '#1A1F3A',
    gridLine: 'rgba(255,255,255,0.05)',
    ghostValid: 'rgba(94,231,223,0.40)',
    ghostInvalid: 'rgba(255,92,122,0.34)',
    overlay: 'rgba(5,7,17,0.88)',
    coin: '#FFC94D',
  },
  blocks: {
    aqua: skin('#3FD9CE', '#93F4EE', '#1C948C', 'rgba(63,217,206,0.55)'),
    violet: skin('#8B7BFF', '#C2B8FF', '#57499E', 'rgba(139,123,255,0.55)'),
    coral: skin('#FF7A6B', '#FFB4AA', '#B8483C', 'rgba(255,122,107,0.55)'),
    lime: skin('#8DE05C', '#C1F29E', '#5AA234', 'rgba(141,224,92,0.55)'),
    amber: skin('#FFC24D', '#FFDF9E', '#BE8A1E', 'rgba(255,194,77,0.55)'),
    rose: skin('#FF6FAE', '#FFACD0', '#BB4079', 'rgba(255,111,174,0.55)'),
    sky: skin('#57B8FF', '#A0D9FF', '#2A7EC0', 'rgba(87,184,255,0.55)'),
  },
  backdrop: ['#0A0C17', '#101533', '#0A0C17'],
  particles: ['#5EE7DF', '#8B7BFF', '#FF6FAE', '#FFC24D', '#F3F5FF'],
};

// ------------------------------------------------------------------ ocean

const OCEAN: Theme = {
  id: 'ocean',
  name: 'Ocean',
  tagline: 'Quiet water, deep light',
  mode: 'dark',
  price: 400,
  unlockLevel: 3,
  colors: {
    background: '#04131C',
    backgroundAlt: '#062334',
    surface: '#0A2334',
    surfaceSecondary: '#0F3048',
    surfaceElevated: '#154059',
    textPrimary: '#EAF7FB',
    textSecondary: '#94B7C7',
    textMuted: '#5C8296',
    accent: '#4FD1C5',
    accentSoft: 'rgba(79,209,197,0.16)',
    accentContrast: '#03181B',
    danger: '#FF7B72',
    dangerSoft: 'rgba(255,123,114,0.18)',
    success: '#6BE0A8',
    warning: '#FFD166',
    boardBackground: '#072130',
    gridCell: '#0D2E42',
    gridLine: 'rgba(255,255,255,0.045)',
    ghostValid: 'rgba(79,209,197,0.40)',
    ghostInvalid: 'rgba(255,123,114,0.32)',
    overlay: 'rgba(3,14,20,0.88)',
    coin: '#FFD166',
  },
  blocks: {
    aqua: skin('#2FC7C0', '#89EDE8', '#137E79', 'rgba(47,199,192,0.55)'),
    violet: skin('#6E8BE8', '#AFC0FF', '#3F55A4', 'rgba(110,139,232,0.55)'),
    coral: skin('#FF8A72', '#FFBFAF', '#BC5341', 'rgba(255,138,114,0.55)'),
    lime: skin('#63D6A0', '#A6EFCB', '#329A6C', 'rgba(99,214,160,0.55)'),
    amber: skin('#F5C46B', '#FFE2AC', '#B88C33', 'rgba(245,196,107,0.55)'),
    rose: skin('#E8779E', '#FFB0C9', '#A94268', 'rgba(232,119,158,0.55)'),
    sky: skin('#4EA8E0', '#96D2F5', '#256F9C', 'rgba(78,168,224,0.55)'),
  },
  backdrop: ['#04131C', '#07293C', '#04131C'],
  particles: ['#4FD1C5', '#4EA8E0', '#6BE0A8', '#FFD166', '#EAF7FB'],
};

// ------------------------------------------------------------------ candy

const CANDY: Theme = {
  id: 'candy',
  name: 'Candy',
  tagline: 'Bright, soft and sweet',
  mode: 'light',
  price: 900,
  unlockLevel: 6,
  colors: {
    background: '#FFF6F1',
    backgroundAlt: '#FFE9EF',
    surface: '#FFFFFF',
    surfaceSecondary: '#FFF0F4',
    surfaceElevated: '#FFFFFF',
    textPrimary: '#2C1F33',
    textSecondary: '#6E5B75',
    textMuted: '#A093A6',
    accent: '#FF5FA2',
    accentSoft: 'rgba(255,95,162,0.14)',
    accentContrast: '#FFFFFF',
    danger: '#E23B5B',
    dangerSoft: 'rgba(226,59,91,0.14)',
    success: '#2FBF71',
    warning: '#F2A03D',
    boardBackground: '#FFEEF3',
    gridCell: '#FFE2EB',
    gridLine: 'rgba(44,31,51,0.06)',
    ghostValid: 'rgba(255,95,162,0.34)',
    ghostInvalid: 'rgba(226,59,91,0.28)',
    overlay: 'rgba(44,31,51,0.62)',
    coin: '#F2A03D',
  },
  blocks: {
    aqua: skin('#3ECFC0', '#9FF0E7', '#1E958A', 'rgba(62,207,192,0.5)'),
    violet: skin('#9B6BFF', '#CDB2FF', '#6941B8', 'rgba(155,107,255,0.5)'),
    coral: skin('#FF7362', '#FFB2A7', '#C74839', 'rgba(255,115,98,0.5)'),
    lime: skin('#7FD44E', '#B9EE9A', '#54992E', 'rgba(127,212,78,0.5)'),
    amber: skin('#FFB020', '#FFD782', '#C07C00', 'rgba(255,176,32,0.5)'),
    rose: skin('#FF5FA2', '#FFA5C9', '#C43B75', 'rgba(255,95,162,0.5)'),
    sky: skin('#3FA9F5', '#94D2FC', '#1F76B8', 'rgba(63,169,245,0.5)'),
  },
  backdrop: ['#FFF6F1', '#FFE9EF', '#FFF6F1'],
  particles: ['#FF5FA2', '#9B6BFF', '#FFB020', '#3ECFC0', '#FFFFFF'],
};

// ----------------------------------------------------------------- galaxy

const GALAXY: Theme = {
  id: 'galaxy',
  name: 'Galaxy',
  tagline: 'Violet nebula, far from home',
  mode: 'dark',
  price: 1400,
  unlockLevel: 8,
  colors: {
    background: '#0A0718',
    backgroundAlt: '#170F33',
    surface: '#191136',
    surfaceSecondary: '#231947',
    surfaceElevated: '#2E2060',
    textPrimary: '#F5F0FF',
    textSecondary: '#B5A7D9',
    textMuted: '#7B6CA2',
    accent: '#C77DFF',
    accentSoft: 'rgba(199,125,255,0.16)',
    accentContrast: '#150A28',
    danger: '#FF5C8A',
    dangerSoft: 'rgba(255,92,138,0.18)',
    success: '#5CE4B4',
    warning: '#FFD166',
    boardBackground: '#120B28',
    gridCell: '#1D1440',
    gridLine: 'rgba(255,255,255,0.055)',
    ghostValid: 'rgba(199,125,255,0.40)',
    ghostInvalid: 'rgba(255,92,138,0.32)',
    overlay: 'rgba(6,4,16,0.88)',
    coin: '#FFD166',
  },
  blocks: {
    aqua: skin('#49E0D2', '#9CF4EB', '#1F9A90', 'rgba(73,224,210,0.55)'),
    violet: skin('#A275FF', '#CDB2FF', '#6742B8', 'rgba(162,117,255,0.55)'),
    coral: skin('#FF7B72', '#FFB4AE', '#BC4A42', 'rgba(255,123,114,0.55)'),
    lime: skin('#7ADF9B', '#B4F0C7', '#3EA267', 'rgba(122,223,155,0.55)'),
    amber: skin('#FFC46B', '#FFE0AC', '#C08A2E', 'rgba(255,196,107,0.55)'),
    rose: skin('#F368C8', '#FFA8E4', '#B02F92', 'rgba(243,104,200,0.55)'),
    sky: skin('#6C8CFF', '#A9BCFF', '#3C55C0', 'rgba(108,140,255,0.55)'),
  },
  backdrop: ['#0A0718', '#1B1042', '#0A0718'],
  particles: ['#C77DFF', '#6C8CFF', '#F368C8', '#49E0D2', '#FFFFFF'],
};

// ------------------------------------------------------------------ ember

const EMBER: Theme = {
  id: 'ember',
  name: 'Ember',
  tagline: 'Banked coals, slow burn',
  mode: 'dark',
  price: 1800,
  unlockLevel: 10,
  colors: {
    background: '#150A07',
    backgroundAlt: '#2A1310',
    surface: '#241310',
    surfaceSecondary: '#331B16',
    surfaceElevated: '#43241D',
    textPrimary: '#FFF2EA',
    textSecondary: '#D3AA98',
    textMuted: '#9A7364',
    accent: '#FF8A3D',
    accentSoft: 'rgba(255,138,61,0.16)',
    accentContrast: '#2A1002',
    danger: '#FF5247',
    dangerSoft: 'rgba(255,82,71,0.18)',
    success: '#8FD46A',
    warning: '#FFC93D',
    boardBackground: '#1D0F0C',
    gridCell: '#2B1712',
    gridLine: 'rgba(255,255,255,0.05)',
    ghostValid: 'rgba(255,138,61,0.40)',
    ghostInvalid: 'rgba(255,82,71,0.32)',
    overlay: 'rgba(12,5,3,0.88)',
    coin: '#FFC93D',
  },
  blocks: {
    aqua: skin('#3FBFB0', '#8FE6DC', '#1D8479', 'rgba(63,191,176,0.55)'),
    violet: skin('#A56BE0', '#CFAAF2', '#6A3C9B', 'rgba(165,107,224,0.55)'),
    coral: skin('#FF6A4D', '#FFA994', '#C03A22', 'rgba(255,106,77,0.55)'),
    lime: skin('#A8D94A', '#D3EE95', '#719B23', 'rgba(168,217,74,0.55)'),
    amber: skin('#FFB020', '#FFD782', '#C07C00', 'rgba(255,176,32,0.55)'),
    rose: skin('#FF5C86', '#FFA1B8', '#C02D53', 'rgba(255,92,134,0.55)'),
    sky: skin('#4FA3E0', '#9BCEF2', '#26709F', 'rgba(79,163,224,0.55)'),
  },
  backdrop: ['#150A07', '#2E1611', '#150A07'],
  particles: ['#FF8A3D', '#FFC93D', '#FF5247', '#FFF2EA', '#FFB020'],
};

// -------------------------------------------------------------------- ice

const ICE: Theme = {
  id: 'ice',
  name: 'Ice',
  tagline: 'Clean light, cold edges',
  mode: 'light',
  price: 2200,
  unlockLevel: 12,
  colors: {
    background: '#EDF5FA',
    backgroundAlt: '#DCEBF5',
    surface: '#FFFFFF',
    surfaceSecondary: '#E7F1F8',
    surfaceElevated: '#FFFFFF',
    textPrimary: '#12293A',
    textSecondary: '#4E6E84',
    textMuted: '#8AA5B8',
    accent: '#2E8FCB',
    accentSoft: 'rgba(46,143,203,0.14)',
    accentContrast: '#FFFFFF',
    danger: '#D94A5E',
    dangerSoft: 'rgba(217,74,94,0.14)',
    success: '#2AA97B',
    warning: '#E09327',
    boardBackground: '#E3EFF7',
    gridCell: '#D5E7F2',
    gridLine: 'rgba(18,41,58,0.07)',
    ghostValid: 'rgba(46,143,203,0.34)',
    ghostInvalid: 'rgba(217,74,94,0.28)',
    overlay: 'rgba(18,41,58,0.60)',
    coin: '#E09327',
  },
  blocks: {
    aqua: skin('#31C4C0', '#8FEDEA', '#178B88', 'rgba(49,196,192,0.5)'),
    violet: skin('#7C77E0', '#B4B1F2', '#4A46A3', 'rgba(124,119,224,0.5)'),
    coral: skin('#FF7A6B', '#FFB3A8', '#C24A3D', 'rgba(255,122,107,0.5)'),
    lime: skin('#5FC46B', '#A6E4AE', '#348A3F', 'rgba(95,196,107,0.5)'),
    amber: skin('#F0A93A', '#FFD28A', '#B0741A', 'rgba(240,169,58,0.5)'),
    rose: skin('#EC6BA8', '#FBA9CE', '#AF3B75', 'rgba(236,107,168,0.5)'),
    sky: skin('#3E9BD6', '#93CBEE', '#1F6C9C', 'rgba(62,155,214,0.5)'),
  },
  backdrop: ['#EDF5FA', '#DCEBF5', '#EDF5FA'],
  particles: ['#2E8FCB', '#31C4C0', '#7C77E0', '#FFFFFF', '#E09327'],
};

// ------------------------------------------------------------------ retro

const RETRO: Theme = {
  id: 'retro',
  name: 'Retro',
  tagline: 'Phosphor glow, tube warmth',
  mode: 'dark',
  price: 2600,
  unlockLevel: 14,
  colors: {
    background: '#0B120D',
    backgroundAlt: '#122117',
    surface: '#111C15',
    surfaceSecondary: '#18291D',
    surfaceElevated: '#21382A',
    textPrimary: '#DFFFE4',
    textSecondary: '#8FC79B',
    textMuted: '#5D8A68',
    accent: '#7CFF6B',
    accentSoft: 'rgba(124,255,107,0.14)',
    accentContrast: '#06170A',
    danger: '#FF6B5A',
    dangerSoft: 'rgba(255,107,90,0.18)',
    success: '#7CFF6B',
    warning: '#FFD447',
    boardBackground: '#0E1810',
    gridCell: '#152318',
    gridLine: 'rgba(124,255,107,0.07)',
    ghostValid: 'rgba(124,255,107,0.38)',
    ghostInvalid: 'rgba(255,107,90,0.32)',
    overlay: 'rgba(5,10,6,0.9)',
    coin: '#FFD447',
  },
  blocks: {
    aqua: skin('#4FE0C4', '#9CF2E1', '#219B85', 'rgba(79,224,196,0.55)'),
    violet: skin('#9C7BFF', '#C6B2FF', '#5F45B8', 'rgba(156,123,255,0.55)'),
    coral: skin('#FF7A5A', '#FFB39F', '#C04B30', 'rgba(255,122,90,0.55)'),
    lime: skin('#7CFF6B', '#B8FFAE', '#45B038', 'rgba(124,255,107,0.55)'),
    amber: skin('#FFD447', '#FFE99B', '#BF9A00', 'rgba(255,212,71,0.55)'),
    rose: skin('#FF6BA8', '#FFA8CC', '#C03875', 'rgba(255,107,168,0.55)'),
    sky: skin('#5AC8FF', '#A4E2FF', '#2589BF', 'rgba(90,200,255,0.55)'),
  },
  backdrop: ['#0B120D', '#132318', '#0B120D'],
  particles: ['#7CFF6B', '#FFD447', '#4FE0C4', '#DFFFE4', '#FF6B5A'],
};

// ------------------------------------------------------------------- mono

const MONO: Theme = {
  id: 'mono',
  name: 'Mono',
  tagline: 'No colour, all form',
  mode: 'dark',
  price: 3000,
  unlockLevel: 16,
  colors: {
    background: '#0D0D0F',
    backgroundAlt: '#17171A',
    surface: '#16161A',
    surfaceSecondary: '#1F1F24',
    surfaceElevated: '#2A2A30',
    textPrimary: '#FAFAFA',
    textSecondary: '#A8A8B0',
    textMuted: '#6E6E77',
    accent: '#FAFAFA',
    accentSoft: 'rgba(250,250,250,0.12)',
    accentContrast: '#0D0D0F',
    danger: '#E8556A',
    dangerSoft: 'rgba(232,85,106,0.16)',
    success: '#7FD69B',
    warning: '#E8C55A',
    boardBackground: '#111114',
    gridCell: '#1A1A1F',
    gridLine: 'rgba(255,255,255,0.055)',
    ghostValid: 'rgba(250,250,250,0.32)',
    ghostInvalid: 'rgba(232,85,106,0.30)',
    overlay: 'rgba(6,6,8,0.90)',
    coin: '#E8C55A',
  },
  // Distinguished by value rather than hue. Safe because nothing in the game
  // signals meaning through block colour — only through shape and position.
  blocks: {
    aqua: skin('#D8DCDE', '#F2F5F6', '#9BA1A4', 'rgba(216,220,222,0.5)'),
    violet: skin('#B5B2C4', '#DAD8E4', '#7C7A8A', 'rgba(181,178,196,0.5)'),
    coral: skin('#C9B4AE', '#E8DAD6', '#8E7D78', 'rgba(201,180,174,0.5)'),
    lime: skin('#C2CBB8', '#E4EADC', '#89907F', 'rgba(194,203,184,0.5)'),
    amber: skin('#DCD2B8', '#F1EBDA', '#9D957F', 'rgba(220,210,184,0.5)'),
    rose: skin('#CFB8C4', '#EBDBE3', '#93808A', 'rgba(207,184,196,0.5)'),
    sky: skin('#B8C4CF', '#DBE4EB', '#808A93', 'rgba(184,196,207,0.5)'),
  },
  backdrop: ['#0D0D0F', '#17171A', '#0D0D0F'],
  particles: ['#FAFAFA', '#A8A8B0', '#E8C55A', '#D8DCDE', '#6E6E77'],
};

/**
 * Theme registry, cheapest first — the shop renders it in order.
 *
 * Adding a theme is a matter of appending to this array: the shop, the board
 * renderer, the particle system and the backdrop all read from here, and nothing
 * else needs to know the theme exists.
 */
export const THEMES: readonly Theme[] = [NEON, OCEAN, CANDY, GALAXY, EMBER, ICE, RETRO, MONO];

export const DEFAULT_THEME_ID = NEON.id;

export function getTheme(id: string): Theme {
  return THEMES.find((t) => t.id === id) ?? NEON;
}

export function isThemeUnlockable(theme: Theme, level: number): boolean {
  return level >= theme.unlockLevel;
}
