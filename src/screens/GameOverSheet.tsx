import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Confetti } from '../components/animations/Confetti';
import { Button } from '../components/ui/Button';
import { Sheet } from '../components/ui/Sheet';
import { REVIVE_CONFIG } from '../constants/config';
import { getMode } from '../game/modes';
import { useTheme } from '../hooks/useTheme';
import { showInterstitial, showRewarded } from '../services/ads';
import { playSfx } from '../services/audio';
import { useGameStore } from '../stores/useGameStore';
import { useMonetizationStore } from '../stores/useMonetizationStore';
import { usePlayerStore } from '../stores/usePlayerStore';
import { useRouterStore } from '../stores/useRouterStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { showToast } from '../stores/useUiStore';
import { FONT_SIZE, FONT_WEIGHT, RADIUS, SPACING } from '../theme/tokens';

type Props = {
  rescueOffersUsed: number;
};

/**
 * Game over.
 *
 * The rewarded revive is the headline because it is genuinely the best thing on
 * offer here — but the copy states plainly what it costs (an ad) and what it
 * gives (a cleared board), and leaving is always one tap away. The run itself is
 * banked by the store the instant it ends, so this screen only reports what
 * already happened.
 */
export function GameOverSheet({ rescueOffersUsed }: Props) {
  const theme = useTheme();
  const go = useRouterStore((s) => s.go);
  const reducedMotion = useSettingsStore((s) => s.reducedMotion);

  const score = useGameStore((s) => s.score);
  const linesCleared = useGameStore((s) => s.linesClearedThisRun);
  const bestCombo = useGameStore((s) => s.bestComboThisRun);
  const rewards = useGameStore((s) => s.runRewards);
  const reviveRun = useGameStore((s) => s.reviveRun);
  const startNewGame = useGameStore((s) => s.startNewGame);

  const addCoins = usePlayerStore((s) => s.addCoins);
  const mode = useGameStore((s) => s.mode);
  const highScore = usePlayerStore((s) => s.highScores[mode]);

  const canRevive = useMonetizationStore((s) => s.canRevive);
  const registerRevive = useMonetizationStore((s) => s.registerRevive);
  const shouldShowInterstitial = useMonetizationStore((s) => s.shouldShowInterstitial);
  const registerInterstitialShown = useMonetizationStore((s) => s.registerInterstitialShown);
  const setAdInFlight = useMonetizationStore((s) => s.setAdInFlight);

  // The run was already banked by the store when it ended, so this screen is a
  // pure view — nothing here can double-award or be missed by a force-quit.
  const [coinsDoubled, setCoinsDoubled] = useState(false);
  const [busy, setBusy] = useState(false);

  const maybeInterstitial = useCallback(async () => {
    if (!shouldShowInterstitial()) return;
    setAdInFlight(true);
    const shown = await showInterstitial();
    setAdInFlight(false);
    if (shown) registerInterstitialShown();
  }, [registerInterstitialShown, setAdInFlight, shouldShowInterstitial]);

  const handleRevive = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setAdInFlight(true);
    let revived = false;
    const result = await showRewarded('revive', () => {
      revived = true;
      registerRevive();
      reviveRun();
    });
    setAdInFlight(false);
    setBusy(false);
    if (revived) showToast('BACK IN!', 'success');
    else if (result.message) showToast(result.message, 'warning');
  }, [busy, registerRevive, reviveRun, setAdInFlight]);

  const handleDoubleCoins = useCallback(async () => {
    if (busy || coinsDoubled || !rewards) return;
    setBusy(true);
    setAdInFlight(true);
    const bonus = rewards.coinsEarned;
    const result = await showRewarded('double_coins', () => {
      setCoinsDoubled(true);
      addCoins(bonus);
      playSfx('coin');
    });
    setAdInFlight(false);
    setBusy(false);
    if (!result.earned && result.message) showToast(result.message, 'warning');
  }, [addCoins, busy, coinsDoubled, rewards, setAdInFlight]);

  const handleNewGame = useCallback(async () => {
    await maybeInterstitial();
    startNewGame();
  }, [maybeInterstitial, startNewGame]);

  const handleHome = useCallback(async () => {
    await maybeInterstitial();
    go('home');
  }, [go, maybeInterstitial]);

  const reviveAvailable = canRevive();
  const earned = rewards?.coinsEarned ?? 0;

  return (
    <Sheet visible dismissable={false}>
      {rewards?.isHighScore && score > 0 && !reducedMotion ? (
        <Confetti colors={theme.particles} />
      ) : null}

      <View style={styles.header}>
        {rewards?.isHighScore && score > 0 ? (
          <Text style={[styles.newBest, { color: theme.colors.warning }]}>NEW BEST!</Text>
        ) : (
          <Text style={[styles.title, { color: theme.colors.textSecondary }]}>GAME OVER</Text>
        )}
        <Text style={[styles.score, { color: theme.colors.textPrimary }]}>
          {score.toLocaleString()}
        </Text>
        <Text style={[styles.sub, { color: theme.colors.textMuted }]}>
          {getMode(mode).name} best {Math.max(highScore, score).toLocaleString()}
        </Text>
      </View>

      <View style={[styles.stats, { backgroundColor: theme.colors.surfaceSecondary }]}>
        <Stat label="Lines" value={linesCleared.toLocaleString()} />
        <Stat label="Best combo" value={bestCombo > 0 ? `x${bestCombo}` : '—'} />
        <Stat
          label="Coins"
          value={`+${(coinsDoubled ? earned * 2 : earned).toLocaleString()}`}
          tint={theme.colors.coin}
        />
      </View>

      {rewards && rewards.achievements.length > 0 ? (
        <Text style={[styles.unlocks, { color: theme.colors.success }]}>
          {rewards.achievements.map((a) => `${a.glyph} ${a.title}`).join('   ')}
        </Text>
      ) : null}
      {rewards?.leveledUp ? (
        <Text style={[styles.unlocks, { color: theme.colors.accent }]}>
          ★ Level {rewards.newLevel}
        </Text>
      ) : null}

      <View style={styles.actions}>
        {reviveAvailable ? (
          <Button
            label="WATCH AD & CONTINUE"
            caption={`Clears ${Math.round(REVIVE_CONFIG.clearRatioMin * 100)}–${Math.round(
              REVIVE_CONFIG.clearRatioMax * 100,
            )}% of the board · ${REVIVE_CONFIG.MAX_REVIVES_PER_RUN} per run`}
            variant="reward"
            size="lg"
            icon="▶"
            fullWidth
            disabled={busy}
            onPress={handleRevive}
          />
        ) : null}

        {earned > 0 && !coinsDoubled ? (
          <Button
            label={`WATCH AD · DOUBLE ${earned} COINS`}
            variant="secondary"
            size="sm"
            icon="▶"
            fullWidth
            disabled={busy}
            onPress={handleDoubleCoins}
          />
        ) : null}

        <View style={styles.row}>
          <Button
            label="NEW GAME"
            variant="primary"
            fullWidth
            style={styles.flex}
            disabled={busy}
            onPress={handleNewGame}
          />
          <Button
            label="HOME"
            variant="secondary"
            fullWidth
            style={styles.flex}
            disabled={busy}
            onPress={handleHome}
          />
        </View>

        {rescueOffersUsed > 0 && !reviveAvailable ? (
          <Text style={[styles.footnote, { color: theme.colors.textMuted }]}>
            Revive already used this run
          </Text>
        ) : null}
      </View>
    </Sheet>
  );
}

function Stat({ label, value, tint }: { label: string; value: string; tint?: string }) {
  const theme = useTheme();
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: tint ?? theme.colors.textPrimary }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.colors.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', gap: 2 },
  title: {
    fontSize: FONT_SIZE.caption,
    fontWeight: FONT_WEIGHT.heavy,
    letterSpacing: 3,
  },
  newBest: {
    fontSize: FONT_SIZE.label,
    fontWeight: FONT_WEIGHT.heavy,
    letterSpacing: 3,
  },
  score: {
    fontSize: FONT_SIZE.hero,
    fontWeight: FONT_WEIGHT.heavy,
    letterSpacing: -1.5,
    fontVariant: ['tabular-nums'],
  },
  sub: { fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.medium },
  stats: {
    flexDirection: 'row',
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md,
  },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { fontSize: FONT_SIZE.label, fontWeight: FONT_WEIGHT.heavy },
  statLabel: {
    fontSize: FONT_SIZE.micro,
    fontWeight: FONT_WEIGHT.bold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  unlocks: { textAlign: 'center', fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold },
  actions: { gap: SPACING.xs },
  row: { flexDirection: 'row', gap: SPACING.xs },
  flex: { flex: 1 },
  footnote: { textAlign: 'center', fontSize: FONT_SIZE.micro, marginTop: 2 },
});
