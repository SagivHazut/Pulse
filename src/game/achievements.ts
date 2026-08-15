export type AchievementId =
  | 'first_clear'
  | 'combo_5'
  | 'combo_10'
  | 'score_10k'
  | 'score_50k'
  | 'score_100k'
  | 'games_100'
  | 'lines_1000'
  | 'perfect_clear'
  | 'power_user';

export type Achievement = {
  id: AchievementId;
  title: string;
  description: string;
  glyph: string;
  reward: number;
};

/**
 * Glyphs are geometric text symbols, never emoji.
 *
 * Emoji render from the colour font and ignore `color`, so they cannot follow the
 * active theme and sit at a different visual weight beside text glyphs — a grid
 * with two emoji among eight symbols reads as broken rather than varied.
 */
export const ACHIEVEMENTS: readonly Achievement[] = [
  {
    id: 'first_clear',
    title: 'First Pulse',
    description: 'Clear your first line',
    glyph: '✦',
    reward: 25,
  },
  { id: 'combo_5', title: 'On a Roll', description: 'Reach a x5 combo', glyph: '✧', reward: 75 },
  {
    id: 'combo_10',
    title: 'Overdrive',
    description: 'Reach a x10 combo',
    glyph: '▲',
    reward: 200,
  },
  { id: 'score_10k', title: 'Ten Thousand', description: 'Score 10,000', glyph: '◆', reward: 50 },
  { id: 'score_50k', title: 'Fifty Up', description: 'Score 50,000', glyph: '◈', reward: 150 },
  {
    id: 'score_100k',
    title: 'Six Figures',
    description: 'Score 100,000',
    glyph: '★',
    reward: 400,
  },
  {
    id: 'games_100',
    title: 'Regular',
    description: 'Play 100 games',
    glyph: '◎',
    reward: 250,
  },
  {
    id: 'lines_1000',
    title: 'Line Cook',
    description: 'Clear 1,000 lines',
    glyph: '≡',
    reward: 300,
  },
  {
    id: 'perfect_clear',
    title: 'Spotless',
    description: 'Empty the whole board',
    glyph: '○',
    reward: 200,
  },
  {
    id: 'power_user',
    title: 'Charged',
    description: 'Trigger a power block',
    glyph: '◉',
    reward: 50,
  },
];

export const ACHIEVEMENTS_BY_ID: Readonly<Record<AchievementId, Achievement>> =
  ACHIEVEMENTS.reduce(
    (acc, a) => {
      acc[a.id] = a;
      return acc;
    },
    {} as Record<AchievementId, Achievement>,
  );

export type AchievementStats = {
  highScore: number;
  bestCombo: number;
  totalGames: number;
  totalLinesCleared: number;
  hadPerfectClear: boolean;
  usedPowerBlock: boolean;
  clearedAnyLine: boolean;
};

const PREDICATES: Record<AchievementId, (s: AchievementStats) => boolean> = {
  first_clear: (s) => s.clearedAnyLine,
  combo_5: (s) => s.bestCombo >= 5,
  combo_10: (s) => s.bestCombo >= 10,
  score_10k: (s) => s.highScore >= 10_000,
  score_50k: (s) => s.highScore >= 50_000,
  score_100k: (s) => s.highScore >= 100_000,
  games_100: (s) => s.totalGames >= 100,
  lines_1000: (s) => s.totalLinesCleared >= 1000,
  perfect_clear: (s) => s.hadPerfectClear,
  power_user: (s) => s.usedPowerBlock,
};

/** Achievements newly satisfied by `stats` that aren't in `unlocked` yet. */
export function evaluateAchievements(
  stats: AchievementStats,
  unlocked: readonly string[],
): Achievement[] {
  const have = new Set(unlocked);
  return ACHIEVEMENTS.filter((a) => !have.has(a.id) && PREDICATES[a.id](stats));
}
