import { create } from 'zustand';

import { evaluateAchievements, type Achievement, type AchievementStats } from '../game/achievements';
import { dailyRewardAmount, dayKey, evaluateDaily, type DailyState } from '../game/dailyReward';
import { DEFAULT_MODE } from '../game/modes';
import { levelFromXp, levelProgress } from '../game/progression';
import { BLOCK_FINISHES } from '../theme/finishes';
import { getTheme, THEMES } from '../theme/themes';
import { track } from '../services/analytics';
import { getPlayerData, patchPlayerData } from '../services/storage/playerData';
import type { GameMode } from '../types';

/**
 * A run to bank. Absolute fields feed records (max), delta fields feed lifetime
 * totals — see `game/runBanking.ts` for why they differ after a revive.
 */
export type RunSummary = {
  /** Which mode the run was played in — records are kept per mode. */
  mode: GameMode;
  /** Final score so far. Compared against that mode's high score. */
  score: number;
  /** Best combo so far. Compared against the best-combo record. */
  bestCombo: number;
  hadPerfectClear: boolean;
  usedPowerBlock: boolean;
  clearedAnyLine: boolean;
  /** Lines not yet added to the lifetime total. */
  linesDelta: number;
  /** XP not yet credited. */
  xpDelta: number;
  /** Coins not yet paid. */
  coinsEarned: number;
  /** False when this run was already counted in `totalGames` (revived run). */
  countGame: boolean;
};

export type RunRewards = {
  coinsEarned: number;
  isHighScore: boolean;
  previousHighScore: number;
  leveledUp: boolean;
  newLevel: number;
  achievements: Achievement[];
};

type PlayerState = {
  highScores: Record<GameMode, number>;
  selectedMode: GameMode;
  totalGames: number;
  totalLinesCleared: number;
  totalCoins: number;
  bestCombo: number;
  xp: number;
  level: number;
  unlockedThemes: string[];
  selectedTheme: string;
  unlockedFinishes: string[];
  selectedFinish: string;
  unlockedAchievements: string[];
  lastDailyReward: string | null;
  currentStreak: number;
  tutorialCompleted: boolean;
  /** Newest unlock, surfaced as a toast then cleared. */
  pendingAchievement: Achievement | null;

  hydrate(): void;
  commitRun(summary: RunSummary): RunRewards;
  addCoins(amount: number): void;
  spendCoins(amount: number): boolean;
  selectTheme(id: string): void;
  purchaseTheme(id: string): boolean;
  selectFinish(id: string): void;
  purchaseFinish(id: string): boolean;
  completeTutorial(): void;
  dailyState(): DailyState;
  claimDaily(multiplier?: number): number;
  dismissAchievement(): void;
  setMode(mode: GameMode): void;
};

export const usePlayerStore = create<PlayerState>((set, get) => ({
  highScores: { classic: 0, pulse: 0 },
  selectedMode: DEFAULT_MODE,
  totalGames: 0,
  totalLinesCleared: 0,
  totalCoins: 0,
  bestCombo: 0,
  xp: 0,
  level: 1,
  unlockedThemes: ['neon'],
  selectedTheme: 'neon',
  unlockedFinishes: ['gloss'],
  selectedFinish: 'gloss',
  unlockedAchievements: [],
  lastDailyReward: null,
  currentStreak: 0,
  tutorialCompleted: false,
  pendingAchievement: null,

  hydrate() {
    const d = getPlayerData();
    set({
      highScores: d.highScores,
      selectedMode: d.selectedMode,
      totalGames: d.totalGames,
      totalLinesCleared: d.totalLinesCleared,
      totalCoins: d.totalCoins,
      bestCombo: d.bestCombo,
      xp: d.xp,
      level: levelFromXp(d.xp),
      unlockedThemes: d.unlockedThemes,
      selectedTheme: d.selectedTheme,
      unlockedFinishes: d.unlockedFinishes,
      selectedFinish: d.selectedFinish,
      unlockedAchievements: d.unlockedAchievements,
      lastDailyReward: d.lastDailyReward,
      currentStreak: d.currentStreak,
      tutorialCompleted: d.tutorialCompleted,
    });
  },

  commitRun(summary) {
    const s = get();
    const previousHighScore = s.highScores[summary.mode];
    const isHighScore = summary.score > previousHighScore;

    const xp = s.xp + summary.xpDelta;
    const newLevel = levelFromXp(xp);
    const leveledUp = newLevel > s.level;

    const highScores = {
      ...s.highScores,
      [summary.mode]: Math.max(previousHighScore, summary.score),
    };

    const stats: AchievementStats = {
      // Achievements are lifetime and mode-agnostic: the best score in any mode.
      highScore: Math.max(highScores.classic, highScores.pulse),
      bestCombo: Math.max(s.bestCombo, summary.bestCombo),
      totalGames: s.totalGames + (summary.countGame ? 1 : 0),
      totalLinesCleared: s.totalLinesCleared + summary.linesDelta,
      hadPerfectClear: summary.hadPerfectClear,
      usedPowerBlock: summary.usedPowerBlock,
      clearedAnyLine: summary.clearedAnyLine,
    };

    const achievements = evaluateAchievements(stats, s.unlockedAchievements);
    const achievementCoins = achievements.reduce((sum, a) => sum + a.reward, 0);
    const totalCoins = s.totalCoins + summary.coinsEarned + achievementCoins;

    const next = {
      highScores,
      totalGames: stats.totalGames,
      totalLinesCleared: stats.totalLinesCleared,
      bestCombo: stats.bestCombo,
      totalCoins,
      xp,
      level: newLevel,
      unlockedAchievements: [...s.unlockedAchievements, ...achievements.map((a) => a.id)],
    };

    patchPlayerData(next);
    set({ ...next, pendingAchievement: achievements[0] ?? null });

    if (leveledUp) track('level_up', { level: newLevel });
    for (const achievement of achievements) {
      track('achievement_unlocked', { id: achievement.id, reward: achievement.reward });
    }

    return {
      coinsEarned: summary.coinsEarned + achievementCoins,
      isHighScore,
      previousHighScore,
      leveledUp,
      newLevel,
      achievements,
    };
  },

  addCoins(amount) {
    if (amount <= 0) return;
    const totalCoins = get().totalCoins + amount;
    patchPlayerData({ totalCoins });
    set({ totalCoins });
  },

  spendCoins(amount) {
    const { totalCoins } = get();
    if (amount > totalCoins) return false;
    const next = totalCoins - amount;
    patchPlayerData({ totalCoins: next });
    set({ totalCoins: next });
    return true;
  },

  selectTheme(id) {
    if (!get().unlockedThemes.includes(id)) return;
    patchPlayerData({ selectedTheme: id });
    track('theme_selected', { theme: id });
    set({ selectedTheme: id });
  },

  purchaseTheme(id) {
    const s = get();
    const theme = THEMES.find((t) => t.id === id);
    if (!theme || s.unlockedThemes.includes(id)) return false;
    if (s.level < theme.unlockLevel) return false;
    if (s.totalCoins < theme.price) return false;

    const unlockedThemes = [...s.unlockedThemes, id];
    const totalCoins = s.totalCoins - theme.price;
    patchPlayerData({ unlockedThemes, totalCoins, selectedTheme: id });
    track('theme_unlocked', { theme: id, price: theme.price });
    set({ unlockedThemes, totalCoins, selectedTheme: id });
    return true;
  },

  selectFinish(id) {
    if (!get().unlockedFinishes.includes(id)) return;
    patchPlayerData({ selectedFinish: id });
    track('theme_selected', { finish: id });
    set({ selectedFinish: id });
  },

  purchaseFinish(id) {
    const s = get();
    const finish = BLOCK_FINISHES.find((f) => f.id === id);
    if (!finish || s.unlockedFinishes.includes(id)) return false;
    if (s.level < finish.unlockLevel) return false;
    if (s.totalCoins < finish.price) return false;

    const unlockedFinishes = [...s.unlockedFinishes, id];
    const totalCoins = s.totalCoins - finish.price;
    patchPlayerData({ unlockedFinishes, totalCoins, selectedFinish: id });
    track('theme_unlocked', { finish: id, price: finish.price });
    set({ unlockedFinishes, totalCoins, selectedFinish: id });
    return true;
  },

  completeTutorial() {
    patchPlayerData({ tutorialCompleted: true });
    track('tutorial_completed', {});
    set({ tutorialCompleted: true });
  },

  dailyState() {
    const s = get();
    return evaluateDaily(s.lastDailyReward, s.currentStreak);
  },

  claimDaily(multiplier = 1) {
    const s = get();
    const state = evaluateDaily(s.lastDailyReward, s.currentStreak);
    if (!state.claimable) return 0;

    const amount = Math.round(dailyRewardAmount(state.day) * multiplier);
    const currentStreak = state.streak + 1;
    const today = dayKey(new Date());
    const totalCoins = s.totalCoins + amount;

    patchPlayerData({ lastDailyReward: today, currentStreak, totalCoins });
    track('daily_reward', { day: state.day, amount, multiplier, streak: currentStreak });
    set({ lastDailyReward: today, currentStreak, totalCoins });
    return amount;
  },

  dismissAchievement() {
    set({ pendingAchievement: null });
  },

  setMode(mode) {
    if (get().selectedMode === mode) return;
    patchPlayerData({ selectedMode: mode });
    track('settings_changed', { setting: 'mode', value: mode });
    set({ selectedMode: mode });
  },
}));

/** Convenience selectors. */
export const selectLevelProgress = (state: PlayerState) => levelProgress(state.xp);
export const selectActiveTheme = (state: PlayerState) => getTheme(state.selectedTheme);
