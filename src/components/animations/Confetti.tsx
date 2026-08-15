import React, { memo, useMemo } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { createRng } from '../../utils/rng';

type Props = {
  colors: string[];
  count?: number;
  enabled?: boolean;
  /** Change to get a different scatter. Seeding keeps render pure. */
  seed?: number;
};

type Piece = {
  x: number;
  delay: number;
  duration: number;
  color: string;
  size: number;
  drift: number;
  spin: number;
};

const Confetto = memo(function Confetto({ piece, height }: { piece: Piece; height: number }) {
  const progress = useSharedValue(0);

  React.useEffect(() => {
    progress.value = withDelay(
      piece.delay,
      withTiming(1, { duration: piece.duration, easing: Easing.linear }),
    );
  }, [piece.delay, piece.duration, progress]);

  const style = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      opacity: p === 0 ? 0 : p > 0.85 ? (1 - p) / 0.15 : 1,
      transform: [
        { translateY: -30 + p * (height + 60) },
        { translateX: Math.sin(p * Math.PI * 2) * piece.drift },
        { rotateZ: `${p * piece.spin}deg` },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: piece.x,
          top: 0,
          width: piece.size,
          height: piece.size * 1.6,
          borderRadius: 2,
          backgroundColor: piece.color,
        },
        style,
      ]}
    />
  );
});

/** Fires once on mount. Used for a new personal best. */
export function Confetti({ colors, count = 34, enabled = true, seed = 7 }: Props) {
  const { width, height } = useWindowDimensions();

  const pieces = useMemo<Piece[]>(() => {
    if (!enabled) return [];
    // Seeded rather than Math.random: rendering stays pure, and the scatter is
    // still varied because every piece pulls fresh values from the stream.
    const rng = createRng(seed * 7919 + count);
    return Array.from({ length: count }, () => ({
      x: rng() * width,
      delay: rng() * 500,
      duration: 1600 + rng() * 1400,
      color: colors[Math.floor(rng() * colors.length)],
      size: 6 + rng() * 6,
      drift: 12 + rng() * 40,
      spin: 180 + rng() * 720,
    }));
  }, [colors, count, enabled, seed, width]);

  if (!enabled) return null;

  return (
    <Animated.View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((piece, index) => (
        <Confetto key={index} piece={piece} height={height} />
      ))}
    </Animated.View>
  );
}
