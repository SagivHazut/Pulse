import { PROGRESSION } from '../constants/config';

/** Cumulative XP required to reach a given level. */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  let total = 0;
  for (let n = 1; n < level; n += 1) {
    total += Math.round(PROGRESSION.xpBase * Math.pow(n, PROGRESSION.xpExponent));
  }
  return total;
}

export function levelFromXp(xp: number): number {
  let level = 1;
  while (xp >= xpForLevel(level + 1) && level < 999) level += 1;
  return level;
}

export type LevelProgress = {
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  progress: number;
};

export function levelProgress(xp: number): LevelProgress {
  const level = levelFromXp(xp);
  const floor = xpForLevel(level);
  const ceiling = xpForLevel(level + 1);
  const span = Math.max(1, ceiling - floor);
  return {
    level,
    xpIntoLevel: xp - floor,
    xpForNextLevel: span,
    progress: Math.min(1, (xp - floor) / span),
  };
}

export function xpFromRun(score: number, linesCleared: number): number {
  return (
    Math.floor((score / 100) * PROGRESSION.xpPerHundredPoints) +
    linesCleared * PROGRESSION.xpPerLineCleared
  );
}
