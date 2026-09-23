import React, { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '../../hooks/useTheme';
import { useAccessibilityAnnounce } from '../../utils/announce';
import { GLYPH } from '../../theme/glyphs';
import { FONT_SIZE, FONT_WEIGHT, RADIUS, SPACING } from '../../theme/tokens';
import { IconButton } from '../ui/IconButton';

type Props = {
  score: number;
  highScore: number;
  coins: number;
  reducedMotion: boolean;
  onSettings: () => void;
  onHome: () => void;
  /** Reports the score counter's window position so points can fly to it. */
  onScoreAnchor?: (x: number, y: number) => void;
};

/**
 * The gameplay header.
 *
 * Two rows rather than one. An earlier version put home, best, coins and
 * settings in a single `space-between` row, but the right-hand group is much
 * wider than the left, so the "centred" best score was pushed off-centre and
 * ended up jammed against the coin pill.
 *
 * Now the top row carries only controls and currency — pushed to opposite edges
 * with real space between them — and the best score sits under the current score
 * as its subtitle. That also gives a truer hierarchy: the live score dominates,
 * and the number to beat reads directly beneath it.
 */
export function ScoreHud({
  score,
  highScore,
  coins,
  reducedMotion,
  onSettings,
  onHome,
  onScoreAnchor,
}: Props) {
  const theme = useTheme();
  const pop = useSharedValue(1);
  const previous = useRef(score);
  const scoreRef = useRef<View>(null);

  // The live region on the score covers Android; iOS ignores it entirely.
  useAccessibilityAnnounce(`Score ${score}`);

  useEffect(() => {
    if (score === previous.current) return;
    const grew = score > previous.current;
    previous.current = score;
    if (!grew || reducedMotion) return;
    pop.value = withSequence(
      withSpring(1.12, { damping: 9, stiffness: 400 }),
      withSpring(1, { damping: 13, stiffness: 300 }),
    );
  }, [score, reducedMotion, pop]);

  const beatingBest = score > highScore;
  const bestGlow = useSharedValue(0);
  useEffect(() => {
    bestGlow.value = withTiming(beatingBest ? 1 : 0, { duration: 300 });
  }, [beatingBest, bestGlow]);

  const scoreStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  const bestStyle = useAnimatedStyle(() => ({ opacity: 0.7 + bestGlow.value * 0.3 }));

  const measure = useCallback(() => {
    scoreRef.current?.measureInWindow((x, y, width, height) => {
      onScoreAnchor?.(x + width / 2, y + height / 2);
    });
  }, [onScoreAnchor]);

  return (
    <View style={styles.wrap}>
      <View style={styles.controls}>
        <IconButton glyph={GLYPH.back} label="Back to home" onPress={onHome} />

        <View style={styles.spacer} />

        <View
          style={[
            styles.coinPill,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.gridLine },
          ]}
          accessible
          accessibilityLabel={`${coins} coins`}
        >
          <Text style={{ color: theme.colors.coin, fontSize: FONT_SIZE.caption }}>◉</Text>
          <Text
            style={{
              color: theme.colors.textPrimary,
              fontSize: FONT_SIZE.caption,
              fontWeight: FONT_WEIGHT.bold,
            }}
          >
            {coins.toLocaleString()}
          </Text>
        </View>

        <IconButton glyph={GLYPH.settings} label="Settings" onPress={onSettings} />
      </View>

      <View style={styles.scoreBlock}>
        <View ref={scoreRef} onLayout={measure} collapsable={false}>
          <Animated.Text
            accessibilityLiveRegion="polite"
            accessibilityLabel={`Score ${score}`}
            style={[styles.score, { color: theme.colors.textPrimary }, scoreStyle]}
          >
            {score.toLocaleString()}
          </Animated.Text>
        </View>

        <Animated.View style={[styles.bestRow, bestStyle]}>
          <Text
            style={[
              styles.bestLabel,
              { color: beatingBest ? theme.colors.warning : theme.colors.textMuted },
            ]}
          >
            {beatingBest ? 'NEW BEST' : 'BEST'}
          </Text>
          <Text
            style={[
              styles.bestValue,
              { color: beatingBest ? theme.colors.warning : theme.colors.textSecondary },
            ]}
          >
            {Math.max(highScore, score).toLocaleString()}
          </Text>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch', alignItems: 'center' },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: SPACING.xs,
  },
  spacer: { flex: 1 },
  coinPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 7,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
  },
  /**
   * The bottom gap is load-bearing. The board is centred in a `flex: 1` parent
   * directly below, so with nothing reserved here it drifts up until "BEST" is
   * almost touching the grid — which read as a layout bug on both platforms.
   */
  scoreBlock: { alignItems: 'center', marginTop: SPACING.xs, marginBottom: SPACING.md },
  score: {
    fontSize: FONT_SIZE.display,
    fontWeight: FONT_WEIGHT.heavy,
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  bestRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginTop: -2 },
  bestLabel: {
    fontSize: FONT_SIZE.micro,
    fontWeight: FONT_WEIGHT.bold,
    letterSpacing: 1.6,
  },
  bestValue: {
    fontSize: FONT_SIZE.caption,
    fontWeight: FONT_WEIGHT.bold,
    fontVariant: ['tabular-nums'],
  },
});
