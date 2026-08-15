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
export function TutorialOverlay() {
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

  if (completed || dismissed || status === 'gameover') return null;

  const current = STEPS[Math.min(step, STEPS.length - 1)];

  return (
    <FadeInView pointerEvents="box-none" style={styles.wrap}>
      <View
        style={[
          styles.card,
          ELEVATION.card,
          { backgroundColor: theme.colors.surfaceElevated, borderColor: theme.colors.accent },
        ]}
      >
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
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>{current.title}</Text>
        <Text style={[styles.body, { color: theme.colors.textSecondary }]}>{current.body}</Text>
        <PressableScale
          onPress={() => {
            setDismissed(true);
            completeTutorial();
          }}
          sound={false}
          style={styles.skip}
          accessibilityLabel="Skip tutorial"
        >
          <Text style={{ color: theme.colors.textMuted, fontSize: FONT_SIZE.micro }}>SKIP</Text>
        </PressableScale>
      </View>
    </FadeInView>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch', alignItems: 'center' },
  card: {
    maxWidth: 320,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    gap: 3,
  },
  dots: { flexDirection: 'row', gap: 5, marginBottom: 3 },
  dot: { width: 16, height: 3, borderRadius: 2 },
  title: { fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.heavy },
  body: { fontSize: FONT_SIZE.caption, textAlign: 'center' },
  skip: { paddingTop: 4, minHeight: 24 },
});
