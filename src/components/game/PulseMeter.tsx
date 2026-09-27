import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '../../hooks/useTheme';
import { FONT_SIZE, FONT_WEIGHT, RADIUS, SPACING } from '../../theme/tokens';

type Props = {
  value: number;
  combo: number;
  freezeCharges: number;
  reducedMotion: boolean;
};

/** The Pulse meter: fills with clears, pays out a free power-up when full. */
export function PulseMeter({ value, combo, freezeCharges, reducedMotion }: Props) {
  const theme = useTheme();
  const fill = useSharedValue(value);

  useEffect(() => {
    fill.value = reducedMotion
      ? withTiming(value, { duration: 120 })
      : withSpring(value, { damping: 18, stiffness: 200 });
  }, [value, reducedMotion, fill]);

  // Scaled, not resized. Animating `width` forces a layout pass on every frame
  // and cannot take Reanimated's direct-to-screen path, so the meter competed
  // with the board for the same frames while a clear was filling it.
  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: Math.max(0, Math.min(1, fill.value)) }],
  }));

  return (
    <View style={styles.wrap}>
      <View style={styles.labels}>
        <Text style={[styles.label, { color: theme.colors.textMuted }]}>PULSE</Text>
        <View style={styles.badges}>
          {freezeCharges > 0 ? (
            <Text
              style={[styles.badge, { color: theme.colors.accent }]}
              accessibilityLabel={`${freezeCharges} freeze charge`}
            >
              ❄ {freezeCharges}
            </Text>
          ) : null}
          {combo >= 2 ? (
            <Text style={[styles.badge, { color: theme.colors.warning }]}>x{combo}</Text>
          ) : null}
        </View>
      </View>
      <View
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
        style={[styles.track, { backgroundColor: theme.colors.surfaceSecondary }]}
      >
        <Animated.View
          style={[styles.fill, { backgroundColor: theme.colors.accent }, fillStyle]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch', gap: 5 },
  labels: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badges: { flexDirection: 'row', gap: SPACING.xs },
  label: { fontSize: FONT_SIZE.micro, fontWeight: FONT_WEIGHT.bold, letterSpacing: 1.6 },
  badge: { fontSize: FONT_SIZE.micro, fontWeight: FONT_WEIGHT.heavy, letterSpacing: 0.8 },
  track: { height: 6, borderRadius: RADIUS.pill, overflow: 'hidden' },
  // Full width, scaled from its left edge. The track's rounded, clipped ends
  // keep a partly scaled fill looking like a bar rather than a squashed pill.
  fill: { width: '100%', height: '100%', transformOrigin: 'left' },
});
