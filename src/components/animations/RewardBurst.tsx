import React, { memo, useEffect, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { createRng } from '../../utils/rng';

type Props = {
  /** Coin colour, usually `theme.colors.coin`. */
  color: string;
  count?: number;
  /** How far the coins travel, in points. */
  radius?: number;
  enabled?: boolean;
};

type Spark = {
  angle: number;
  distance: number;
  size: number;
  delay: number;
  duration: number;
};

const Coin = memo(function Coin({ spark, color }: { spark: Spark; color: string }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      spark.delay,
      withTiming(1, { duration: spark.duration, easing: Easing.out(Easing.quad) }),
    );
  }, [progress, spark.delay, spark.duration]);

  const style = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      opacity: p < 0.15 ? p / 0.15 : 1 - (p - 0.15) / 0.85,
      transform: [
        { translateX: Math.cos(spark.angle) * spark.distance * p },
        { translateY: Math.sin(spark.angle) * spark.distance * p + 18 * p * p },
        { scale: 0.4 + p * 0.7 },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          width: spark.size,
          height: spark.size,
          borderRadius: spark.size / 2,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
});

/**
 * A ring of coins bursting out from the centre of its parent.
 *
 * Self-contained on purpose: it needs no measurement and no coordinates, so it
 * can be dropped into any container that has a centre. Seeded rather than random
 * so rendering stays pure.
 */
export function RewardBurst({ color, count = 14, radius = 96, enabled = true }: Props) {
  const sparks = useMemo<Spark[]>(() => {
    if (!enabled) return [];
    const rng = createRng(count * 977 + radius);
    return Array.from({ length: count }, (_, i) => ({
      // Even spread with a little jitter, so it reads as a burst not a clock face.
      angle: (i / count) * Math.PI * 2 + (rng() - 0.5) * 0.6,
      distance: radius * (0.55 + rng() * 0.65),
      size: 7 + rng() * 7,
      delay: rng() * 90,
      duration: 520 + rng() * 320,
    }));
  }, [count, radius, enabled]);

  if (!enabled) return null;

  return (
    <Animated.View pointerEvents="none" style={styles.wrap}>
      {sparks.map((spark, index) => (
        <Coin key={index} spark={spark} color={color} />
      ))}
    </Animated.View>
  );
}

/** The claimed amount, springing in over the burst. */
export function RewardAmount({
  amount,
  color,
  reducedMotion,
}: {
  amount: number;
  color: string;
  reducedMotion: boolean;
}) {
  const progress = useSharedValue(reducedMotion ? 1 : 0);

  useEffect(() => {
    if (reducedMotion) return;
    progress.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.back(2.2)) });
  }, [progress, reducedMotion]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.5 + progress.value * 0.5 }],
  }));

  return (
    <Animated.Text style={[styles.amount, { color }, style]}>
      +{amount.toLocaleString()}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  amount: {
    fontSize: 52,
    fontWeight: '800',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
});
