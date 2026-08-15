import React, { memo, useEffect, useMemo } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '../../hooks/useTheme';
import { RADIUS } from '../../theme/tokens';

type Props = {
  /** 0–1. Warms the backdrop as the board fills. */
  tension?: number;
  /** Drifting blocks — on for menus, off during play to keep the board calm. */
  animated?: boolean;
  reducedMotion?: boolean;
};

type Drifter = {
  x: number;
  y: number;
  size: number;
  color: string;
  delay: number;
  duration: number;
  rotate: number;
};

const DriftingBlock = memo(function DriftingBlock({ block }: { block: Drifter }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      block.delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: block.duration, easing: Easing.inOut(Easing.quad) }),
          withTiming(0, { duration: block.duration, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        false,
      ),
    );
  }, [block.delay, block.duration, progress]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: -18 + progress.value * 36 },
      { rotateZ: `${block.rotate + progress.value * 18}deg` },
      { scale: 0.95 + progress.value * 0.1 },
    ],
    opacity: 0.06 + progress.value * 0.05,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: block.x,
          top: block.y,
          width: block.size,
          height: block.size,
          borderRadius: RADIUS.sm,
          backgroundColor: block.color,
        },
        style,
      ]}
    />
  );
});

/**
 * The app's background: a theme gradient, a few very quiet drifting blocks, and
 * a danger wash that rises with board tension.
 */
export function AnimatedBackdrop({ tension = 0, animated = true, reducedMotion = false }: Props) {
  const theme = useTheme();
  const { width, height } = useWindowDimensions();

  const blocks = useMemo<Drifter[]>(() => {
    if (!animated || reducedMotion) return [];
    const palette = theme.particles;
    return Array.from({ length: 9 }, (_, i) => ({
      x: (i * 137) % Math.max(1, width - 90),
      y: ((i * 223) % Math.max(1, height - 120)) + 40,
      size: 42 + ((i * 17) % 60),
      color: palette[i % palette.length],
      delay: i * 260,
      duration: 3200 + ((i * 411) % 2600),
      rotate: (i * 23) % 45,
    }));
  }, [animated, reducedMotion, theme.particles, width, height]);

  const wash = useAnimatedStyle(() => ({ opacity: tension * 0.16 }), [tension]);

  return (
    <>
      <LinearGradient
        colors={theme.backdrop}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
      />
      {blocks.map((block, index) => (
        <DriftingBlock key={index} block={block} />
      ))}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.danger }, wash]}
      />
    </>
  );
}
