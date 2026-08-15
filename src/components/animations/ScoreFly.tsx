import React, { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '../../hooks/useTheme';
import { FONT_SIZE, FONT_WEIGHT } from '../../theme/tokens';

type Props = {
  nonce: number;
  points: number;
  /** Origin of the flight, local to the effects layer. */
  x: number;
  y: number;
  /** Where the score counter sits, so the number flies to it. */
  targetX: number;
  targetY: number;
  emphasis?: number;
  reducedMotion: boolean;
};

/** The turn's points, flying from the board to the score counter. */
export function ScoreFly({
  nonce,
  points,
  x,
  y,
  targetX,
  targetY,
  emphasis = 0,
  reducedMotion,
}: Props) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (points <= 0) return;
    progress.value = 0;
    progress.value = reducedMotion
      ? withSequence(withTiming(1, { duration: 260 }))
      : withTiming(1, { duration: 620, easing: Easing.inOut(Easing.cubic) });
  }, [nonce, points, progress, reducedMotion]);

  const style = useAnimatedStyle(() => {
    const p = progress.value;
    // Hold briefly at the origin, then travel — the number is readable first.
    const travel = Math.max(0, (p - 0.25) / 0.75);
    return {
      opacity: p === 0 ? 0 : p < 0.85 ? 1 : (1 - p) / 0.15,
      transform: [
        { translateX: x + (targetX - x) * travel },
        { translateY: y + (targetY - y) * travel - Math.sin(travel * Math.PI) * 26 },
        { scale: 1 + emphasis * 0.4 - travel * 0.35 },
      ],
    };
  });

  const theme = useTheme();
  if (points <= 0) return null;

  return (
    <Animated.View pointerEvents="none" style={[styles.wrap, style]}>
      <Text
        style={{
          color: emphasis > 0 ? theme.colors.warning : theme.colors.accent,
          fontSize: FONT_SIZE.title + emphasis * 10,
          fontWeight: FONT_WEIGHT.heavy,
          textShadowColor: 'rgba(0,0,0,0.5)',
          textShadowRadius: 6,
        }}
      >
        +{points.toLocaleString()}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, top: 0 },
});
