import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import type { ComboTier } from '../../game/scoring/scoring';
import { useTheme } from '../../hooks/useTheme';
import { FONT_SIZE, FONT_WEIGHT, RADIUS, SPACING } from '../../theme/tokens';

type Props = {
  /** Changes on every clear; drives the animation. */
  nonce: number;
  combo: number;
  tier: ComboTier;
  /** Lines cleared by this one placement. */
  lines: number;
  perfectClear: boolean;
  reducedMotion: boolean;
};

/** What a single placement cleared, in words. */
function multiLineLabel(lines: number): string | null {
  if (lines >= 4) return 'MEGA CLEAR';
  if (lines === 3) return 'TRIPLE';
  if (lines === 2) return 'DOUBLE';
  return null;
}

/**
 * The clear callout. It escalates in wording, size and colour, and never blocks
 * gameplay — it lives in a `pointerEvents: none` layer and fades on its own.
 *
 * It used to appear only for a combo of 2 or more, so the move players feel as
 * the big one — clearing two or three lines with a single piece — looked exactly
 * like clearing one. Multi-line clears and perfect clears now get their own
 * headline, with the running combo underneath when there is one.
 */
export function ComboBadge({ nonce, combo, tier, lines, perfectClear, reducedMotion }: Props) {
  const theme = useTheme();
  const progress = useSharedValue(0);
  const scale = useSharedValue(0.6);
  const tilt = useSharedValue(0);

  const multi = multiLineLabel(lines);
  const hasCombo = combo >= 2 && tier !== 'none';
  const visible = perfectClear || multi !== null || hasCombo;

  const dramatic = perfectClear || tier === 'dramatic';
  const hype = dramatic || tier === 'hype' || lines >= 3;

  useEffect(() => {
    if (!visible) return;
    if (reducedMotion) {
      progress.value = withSequence(
        withTiming(1, { duration: 120 }),
        withDelay(800, withTiming(0, { duration: 200 })),
      );
      scale.value = 1;
      tilt.value = 0;
      return;
    }
    const hold = hype ? 820 : 640;
    progress.value = withSequence(
      withTiming(1, { duration: 110, easing: Easing.out(Easing.quad) }),
      withDelay(hold, withTiming(0, { duration: 260 })),
    );
    // Overshoot on the way in: a callout that just fades up reads as a label,
    // one that punches in reads as an event.
    scale.value = withSequence(
      withTiming(0.35, { duration: 0 }),
      withSpring(hype ? 1.28 : 1.16, { damping: 8, stiffness: 380 }),
      withSpring(1, { damping: 13, stiffness: 260 }),
    );
    tilt.value = withSequence(
      withTiming(hype ? -7 : -4, { duration: 0 }),
      withSpring(0, { damping: 10, stiffness: 220 }),
    );
  }, [nonce, visible, hype, reducedMotion, progress, scale, tilt]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateY: (1 - progress.value) * 18 },
      { scale: scale.value },
      { rotateZ: `${tilt.value}deg` },
    ],
  }));

  if (!visible) return null;

  const headline = perfectClear
    ? '✦ PERFECT CLEAR'
    : multi ??
      (tier === 'dramatic' ? `⚡ OVERDRIVE x${combo}` : tier === 'hype' ? `🔥 PULSE x${combo}` : `COMBO x${combo}`);
  // The combo moves underneath when a bigger headline has taken the top line.
  const subline = (perfectClear || multi !== null) && hasCombo ? `COMBO x${combo}` : null;

  const color = dramatic ? theme.colors.warning : hype ? theme.colors.accent : theme.colors.textPrimary;

  return (
    <View pointerEvents="none" style={styles.wrap}>
      <Animated.View
        style={[
          styles.badge,
          {
            backgroundColor: dramatic ? theme.colors.warning : theme.colors.surfaceElevated,
            borderColor: hype ? color : theme.colors.gridLine,
            paddingHorizontal: hype ? SPACING.lg : SPACING.md,
            paddingVertical: hype ? SPACING.sm : SPACING.xs,
            shadowColor: color,
            shadowOpacity: hype ? 0.7 : 0.35,
            shadowRadius: hype ? 18 : 10,
            shadowOffset: { width: 0, height: 0 },
          },
          style,
        ]}
      >
        <Text
          style={{
            color: dramatic ? '#2A1A00' : color,
            fontSize: dramatic ? FONT_SIZE.heading : hype ? FONT_SIZE.title : FONT_SIZE.label,
            fontWeight: FONT_WEIGHT.heavy,
            letterSpacing: 1.5,
          }}
        >
          {headline}
        </Text>
        {subline ? (
          <Text
            style={{
              color: dramatic ? '#2A1A00' : theme.colors.textSecondary,
              fontSize: FONT_SIZE.caption,
              fontWeight: FONT_WEIGHT.bold,
              letterSpacing: 1.2,
              marginTop: 2,
            }}
          >
            {subline}
          </Text>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    borderRadius: RADIUS.pill,
    borderWidth: 2,
    alignItems: 'center',
  },
});
