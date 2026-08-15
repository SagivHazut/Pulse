import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedBackdrop } from '../components/animations/AnimatedBackdrop';
import { Button } from '../components/ui/Button';
import { FadeInView } from '../components/ui/FadeInView';
import { PressableScale } from '../components/ui/PressableScale';
import { useTheme } from '../hooks/useTheme';
import { MODE_ORDER, MODES } from '../game/modes';
import { levelProgress } from '../game/progression';
import { startMusic } from '../services/audio';
import { loadSession, sessionModes } from '../services/storage/session';
import { useGameStore } from '../stores/useGameStore';
import { useMonetizationStore } from '../stores/useMonetizationStore';
import { usePlayerStore } from '../stores/usePlayerStore';
import { useRouterStore } from '../stores/useRouterStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { GLYPH } from '../theme/glyphs';
import { ELEVATION, FONT_SIZE, FONT_WEIGHT, RADIUS, SPACING } from '../theme/tokens';
import { DailyRewardSheet } from './DailyRewardSheet';

/**
 * Home.
 *
 * One job: get the player into a game in as few taps as possible. PLAY dominates,
 * everything else is a quiet row underneath, and a saved run is offered rather
 * than forced.
 */
export function HomeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const go = useRouterStore((s) => s.go);
  const reducedMotion = useSettingsStore((s) => s.reducedMotion);

  const highScores = usePlayerStore((s) => s.highScores);
  const selectedMode = usePlayerStore((s) => s.selectedMode);
  const setMode = usePlayerStore((s) => s.setMode);
  const coins = usePlayerStore((s) => s.totalCoins);
  const xp = usePlayerStore((s) => s.xp);
  const dailyState = usePlayerStore((s) => s.dailyState);
  const tutorialCompleted = usePlayerStore((s) => s.tutorialCompleted);

  const startNewGame = useGameStore((s) => s.startNewGame);
  const resumeFrom = useGameStore((s) => s.resumeFrom);
  const beginRun = useMonetizationStore((s) => s.beginRun);

  /**
   * Which modes have a run waiting, read once on mount for both modes at the
   * same time. Storage is already hydrated by the time Home renders, and the
   * screen remounts whenever the player navigates back, so this stays accurate
   * without an effect.
   */
  const [saved, setSaved] = useState(() => sessionModes());
  const [dailyOpen, setDailyOpen] = useState(false);
  const resumable = saved[selectedMode];

  useEffect(() => {
    startMusic();
  }, []);

  const daily = dailyState();
  const progress = levelProgress(xp);

  const handlePlay = useCallback(() => {
    beginRun();
    startNewGame(selectedMode);
    go('game');
  }, [beginRun, go, startNewGame, selectedMode]);

  const handleResume = useCallback(() => {
    const session = loadSession(selectedMode);
    if (!session) {
      // The slot vanished between mount and tap; fall through to a fresh run.
      setSaved(sessionModes());
      handlePlay();
      return;
    }
    beginRun();
    resumeFrom(session);
    go('game');
  }, [beginRun, go, handlePlay, resumeFrom, selectedMode]);

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <AnimatedBackdrop animated reducedMotion={reducedMotion} />

      <View
        style={[
          styles.content,
          { paddingTop: insets.top + SPACING.xl, paddingBottom: insets.bottom + SPACING.lg },
        ]}
      >
        <FadeInView style={styles.brand}>
          <View style={styles.logoRow}>
            <View style={[styles.logoBlock, { backgroundColor: theme.blocks.aqua.base }]} />
            <View style={[styles.logoBlock, { backgroundColor: theme.blocks.violet.base }]} />
            <View style={[styles.logoBlock, { backgroundColor: theme.blocks.rose.base }]} />
          </View>
          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>PULSE</Text>
          <Text style={[styles.titleSub, { color: theme.colors.accent }]}>BLOCKS</Text>
        </FadeInView>

        <FadeInView delay={90} style={styles.stats}>
          <View style={[styles.statCard, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.statLabel, { color: theme.colors.textMuted }]}>COINS</Text>
            <Text style={[styles.statValue, { color: theme.colors.coin }]}>
              {coins.toLocaleString()}
            </Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.statLabel, { color: theme.colors.textMuted }]}>LEVEL</Text>
            <Text style={[styles.statValue, { color: theme.colors.accent }]}>
              {progress.level}
            </Text>
          </View>
        </FadeInView>

        {/*
          The mode picker sits directly above PLAY, showing each mode's own best
          score — that is the number the choice actually affects, and it saves a
          redundant BEST tile in the stats row.
        */}
        <FadeInView delay={140} style={styles.modes}>
          {MODE_ORDER.map((id) => {
            const config = MODES[id];
            const active = selectedMode === id;
            return (
              <PressableScale
                key={id}
                onPress={() => setMode(id)}
                scaleTo={0.98}
                haptic="selection"
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={
                  `${config.name} mode. ${config.tagline}. Best ${highScores[id]}.` +
                  (saved[id] ? ' Game in progress.' : '')
                }
                style={[
                  styles.modeCard,
                  {
                    backgroundColor: active ? theme.colors.accentSoft : theme.colors.surface,
                    borderColor: active ? theme.colors.accent : theme.colors.gridLine,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.modeName,
                    { color: active ? theme.colors.accent : theme.colors.textSecondary },
                  ]}
                >
                  {config.name.toUpperCase()}
                </Text>
                <Text style={[styles.modeBest, { color: theme.colors.textPrimary }]}>
                  {highScores[id].toLocaleString()}
                </Text>
                <Text
                  numberOfLines={2}
                  style={[styles.modeTag, { color: theme.colors.textMuted }]}
                >
                  {config.tagline}
                </Text>
                {saved[id] ? (
                  <Text style={[styles.modeResume, { color: theme.colors.success }]}>
                    ● IN PROGRESS
                  </Text>
                ) : null}
              </PressableScale>
            );
          })}
        </FadeInView>

        <FadeInView delay={170} style={styles.actions}>
          {resumable ? (
            <>
              <Button
                label={`CONTINUE ${MODES[selectedMode].name.toUpperCase()}`}
                size="lg"
                fullWidth
                onPress={handleResume}
              />
              <Button
                label={`NEW ${MODES[selectedMode].name.toUpperCase()} GAME`}
                variant="secondary"
                fullWidth
                onPress={handlePlay}
              />
            </>
          ) : (
            <Button
              label={
                tutorialCompleted
                  ? `PLAY ${MODES[selectedMode].name.toUpperCase()}`
                  : 'PLAY · QUICK TUTORIAL'
              }
              size="lg"
              fullWidth
              onPress={handlePlay}
            />
          )}
        </FadeInView>

        <FadeInView delay={250} style={styles.menu}>
          <MenuTile
            glyph={GLYPH.daily}
            label="Daily"
            badge={daily.claimable ? '!' : undefined}
            onPress={() => setDailyOpen(true)}
          />
          <MenuTile glyph={GLYPH.themes} label="Themes" onPress={() => go('themes')} />
          <MenuTile glyph={GLYPH.settings} label="Settings" onPress={() => go('settings')} />
        </FadeInView>
      </View>

      <DailyRewardSheet visible={dailyOpen} onClose={() => setDailyOpen(false)} />
    </View>
  );
}

function MenuTile({
  glyph,
  label,
  badge,
  onPress,
}: {
  glyph: string;
  label: string;
  badge?: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={badge ? `${label}, available` : label}
      style={[
        styles.tile,
        ELEVATION.card,
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.gridLine },
      ]}
    >
      <Text style={{ fontSize: FONT_SIZE.title, color: theme.colors.accent }}>{glyph}</Text>
      <Text
        style={{
          fontSize: FONT_SIZE.micro,
          fontWeight: FONT_WEIGHT.bold,
          color: theme.colors.textSecondary,
          letterSpacing: 1,
        }}
      >
        {label.toUpperCase()}
      </Text>
      {badge ? (
        <View style={[styles.badge, { backgroundColor: theme.colors.warning }]}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brand: { alignItems: 'center', gap: 2 },
  logoRow: { flexDirection: 'row', gap: 6, marginBottom: SPACING.sm },
  logoBlock: { width: 22, height: 22, borderRadius: 7 },
  title: {
    fontSize: FONT_SIZE.hero,
    fontWeight: FONT_WEIGHT.heavy,
    letterSpacing: 8,
    marginRight: -8,
  },
  titleSub: {
    fontSize: FONT_SIZE.title,
    fontWeight: FONT_WEIGHT.heavy,
    letterSpacing: 11,
    marginRight: -11,
  },
  stats: { flexDirection: 'row', gap: SPACING.xs, alignSelf: 'stretch' },
  modes: { flexDirection: 'row', gap: SPACING.xs, alignSelf: 'stretch' },
  modeCard: {
    flex: 1,
    borderRadius: RADIUS.lg,
    borderWidth: 2,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    alignItems: 'center',
    gap: 1,
  },
  modeName: { fontSize: FONT_SIZE.micro, fontWeight: FONT_WEIGHT.heavy, letterSpacing: 1.4 },
  modeBest: { fontSize: FONT_SIZE.label, fontWeight: FONT_WEIGHT.heavy },
  modeTag: { fontSize: 10, textAlign: 'center', lineHeight: 13 },
  modeResume: {
    fontSize: 9,
    fontWeight: FONT_WEIGHT.heavy,
    letterSpacing: 0.8,
    marginTop: 2,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    gap: 2,
  },
  statLabel: { fontSize: FONT_SIZE.micro, fontWeight: FONT_WEIGHT.bold, letterSpacing: 1.4 },
  statValue: { fontSize: FONT_SIZE.label, fontWeight: FONT_WEIGHT.heavy },
  actions: { alignSelf: 'stretch', gap: SPACING.xs },
  menu: { flexDirection: 'row', gap: SPACING.sm },
  tile: {
    width: 88,
    height: 76,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 11, fontWeight: '800', color: '#2A1A00' },
});
