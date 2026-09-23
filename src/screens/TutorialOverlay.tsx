import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { FadeInView } from '../components/ui/FadeInView';
import { PressableScale } from '../components/ui/PressableScale';
import { useTheme } from '../hooks/useTheme';
import { track } from '../services/analytics';
import { useGameStore } from '../stores/useGameStore';
import { usePlayerStore } from '../stores/usePlayerStore';
import { ELEVATION, FONT_SIZE, FONT_WEIGHT, RADIUS, SPACING } from '../theme/tokens';

type Step = {
  title: string;
  body: string;
};

const STEPS: Step[] = [
  { title: 'Drag a piece', body: 'Pull any piece from the tray onto the board.' },
  { title: 'Fill a line', body: 'Complete a full row or column and it clears.' },
  { title: 'Chain it', body: 'Clear again next turn to build a Pulse combo — big points.' },
];

/**
 * Onboarding that teaches by playing.
 *
 * It sits in the game screen's own layout — in the gap between the board and the
 * tray — rather than floating over the board, so it can never cover the thing it
 * is telling you to look at. Steps advance on real actions, not scripted taps,
 * so the "tutorial" *is* the first run.
 */
type Props = {
  /**
   * Reports whether the card is on screen, so the board can be sized around it.
   *
   * Deliberately a boolean rather than a measured height: the card's body text
   * changes length from step to step, so reporting what it measures would resize
   * the board mid-run. `tutorialReserve` budgets a constant instead.
   */
  onVisibleChange?: (visible: boolean) => void;
  /**
   * Float over the board instead of taking space in the column. Set only where
   * the screen is too short to fit both the card and a playable board — see
   * `canReserveHeight`. Taking space is the default because a card that covers
   * the board contradicts what it is telling the player to do.
   */
  overlay?: boolean;
};

export function TutorialOverlay({ onVisibleChange, overlay = false }: Props) {
  const theme = useTheme();

  const completed = usePlayerStore((s) => s.tutorialCompleted);
  const completeTutorial = usePlayerStore((s) => s.completeTutorial);

  const score = useGameStore((s) => s.score);
  const linesCleared = useGameStore((s) => s.linesClearedThisRun);
  const combo = useGameStore((s) => s.combo);
  const status = useGameStore((s) => s.status);

  const [dismissed, setDismissed] = useState(false);
  const startedTracked = useRef(false);

  // The current step is derived from what the player has actually done, so there
  // is no tutorial state to keep in sync with the game.
  const step = linesCleared > 0 ? 2 : score > 0 ? 1 : 0;

  useEffect(() => {
    if (completed || startedTracked.current) return;
    startedTracked.current = true;
    track('tutorial_started', {});
  }, [completed]);

  useEffect(() => {
    if (completed || dismissed) return;
    // Chained a combo, or cleared enough lines that the point is obviously made.
    if (combo >= 2 || linesCleared >= 3) completeTutorial();
  }, [combo, completed, dismissed, linesCleared, completeTutorial]);

  const visible = !completed && !dismissed && status !== 'gameover';
  const current = STEPS[Math.min(step, STEPS.length - 1)];

  /**
   * The card only costs the board space when it is both on screen and inline;
   * the floating form overlaps the board rather than displacing it. Reported
   * from an effect rather than `onLayout` so an unmounted card still hands its
   * space back.
   */
  useEffect(() => {
    onVisibleChange?.(visible && !overlay);
  }, [visible, overlay, onVisibleChange]);

  if (!visible) return null;

  const skip = (
    <PressableScale
      onPress={() => {
        setDismissed(true);
        completeTutorial();
      }}
      sound={false}
      style={overlay ? styles.compactSkip : styles.skip}
      accessibilityLabel="Skip tutorial"
    >
      <Text style={{ color: theme.colors.textMuted, fontSize: FONT_SIZE.micro }}>SKIP</Text>
    </PressableScale>
  );

  const surface = {
    backgroundColor: theme.colors.surfaceElevated,
    borderColor: theme.colors.accent,
  };

  return (
    <View style={overlay ? styles.floating : styles.wrap} pointerEvents="box-none">
      <FadeInView pointerEvents="box-none" style={styles.fade}>
        {overlay ? (
          /*
            Compact form for screens with no room to spare. It still has to float
            over the board, so it earns its keep by being one line instead of four
            — covering the bottom row rather than half the grid. The step title is
            the instruction; the body text is the part that can go.
          */
          <View style={[styles.compact, ELEVATION.card, surface]}>
            <Text style={[styles.compactTitle, { color: theme.colors.textPrimary }]}>
              {current.title}
            </Text>
            {skip}
          </View>
        ) : (
          <View style={[styles.card, ELEVATION.card, surface]}>
            <View style={styles.dots}>
              {STEPS.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.dot,
                    {
                      backgroundColor:
                        index <= step ? theme.colors.accent : theme.colors.surfaceSecondary,
                    },
                  ]}
                />
              ))}
            </View>
            <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
              {current.title}
            </Text>
            <Text style={[styles.body, { color: theme.colors.textSecondary }]}>
              {current.body}
            </Text>
            {skip}
          </View>
        )}
      </FadeInView>
    </View>
  );
}

const styles = StyleSheet.create({
  // The small top gap keeps the card from sitting flush against the board's
  // bottom edge, which read as the two overlapping rather than stacking.
  wrap: { alignSelf: 'stretch', alignItems: 'center', paddingTop: SPACING.xs },
  /** The inner layer must not repeat the wrapper's padding — that double-counted
   *  against the height the wrapper reports. */
  fade: { alignSelf: 'stretch', alignItems: 'center' },
  /**
   * Short-screen fallback: sits directly above the lower section, overlapping the
   * board's last rows. Reports a height of 0 by virtue of being out of flow, so
   * the board keeps its full (already minimal) size rather than being squeezed
   * until it overflows the score.
   */
  floating: {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingBottom: SPACING.xs,
  },
  card: {
    maxWidth: 320,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    gap: 3,
  },
  compact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    maxWidth: 320,
    borderRadius: RADIUS.pill,
    borderWidth: 1.5,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
  },
  compactTitle: { fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.heavy },
  compactSkip: { minHeight: 20, justifyContent: 'center' },
  dots: { flexDirection: 'row', gap: 5, marginBottom: 3 },
  dot: { width: 16, height: 3, borderRadius: 2 },
  title: { fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.heavy },
  body: { fontSize: FONT_SIZE.caption, textAlign: 'center' },
  skip: { paddingTop: 4, minHeight: 24 },
});
