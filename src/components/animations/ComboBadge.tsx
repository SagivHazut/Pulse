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
  reducedMotion: boolean;
};

/**
 * The combo readout. It escalates in wording, size and colour, and never blocks
 * gameplay — it lives in a `pointerEvents: none` layer and fades on its own.
 */
export function ComboBadge({ nonce, combo, tier, reducedMotion }: Props) {
  const theme = useTheme();
  const progress = useSharedValue(0);
  const scale = useSharedValue(0.6);

  const visible = combo >= 2 && tier !== 'none';

  useEffect(() => {
    if (!visible) return;
    if (reducedMotion) {
      progress.value = withSequence(
        withTiming(1, { duration: 120 }),
        withDelay(700, withTiming(0, { duration: 200 })),
      );
      scale.value = 1;
      return;
    }
    progress.value = withSequence(
      withTiming(1, { duration: 120, easing: Easing.out(Easing.quad) }),
      withDelay(620, withTiming(0, { duration: 240 })),
    );
    scale.value = withSequence(
      withSpring(1.14, { damping: 9, stiffness: 340 }),
      withSpring(1, { damping: 14, stiffness: 260 }),
    );
  }, [nonce, visible, reducedMotion, progress, scale]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: scale.value }, { translateY: (1 - progress.value) * 14 }],
  }));

  if (!visible) return null;

  const dramatic = tier === 'dramatic';
  const hype = tier === 'hype' || dramatic;

  const label = dramatic ? `⚡ OVERDRIVE x${combo}` : hype ? `🔥 PULSE x${combo}` : `COMBO x${combo}`;
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
          },
          style,
        ]}
      >
        <Text
          style={{
            color: dramatic ? '#2A1A00' : color,
            fontSize: dramatic ? FONT_SIZE.heading : hype ? FONT_SIZE.title : FONT_SIZE.label,
            fontWeight: FONT_WEIGHT.heavy,
            letterSpacing: 1,
          }}
        >
          {label}
        </Text>
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
