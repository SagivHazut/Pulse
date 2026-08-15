import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '../hooks/useTheme';
import { FONT_SIZE, FONT_WEIGHT, RADIUS, SPACING } from '../theme/tokens';
import type { BlockColorId } from '../types';

type Props = { onDone: () => void; minDurationMs?: number };

const BLOCKS: BlockColorId[] = ['aqua', 'violet', 'rose'];

/**
 * Branded splash: three blocks drop in, the wordmark resolves, then we leave.
 * There is no spinner — if the app is ready, it moves on immediately.
 */
export function SplashScreen({ onDone, minDurationMs = 1150 }: Props) {
  const theme = useTheme();
  const wordmark = useSharedValue(0);

  useEffect(() => {
    wordmark.value = withDelay(
      420,
      withTiming(1, { duration: 380, easing: Easing.out(Easing.cubic) }),
    );
    const timer = setTimeout(onDone, minDurationMs);
    return () => clearTimeout(timer);
  }, [minDurationMs, onDone, wordmark]);

  const wordStyle = useAnimatedStyle(() => ({
    opacity: wordmark.value,
    transform: [{ translateY: (1 - wordmark.value) * 14 }],
  }));

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <View style={styles.row}>
        {BLOCKS.map((colorId, index) => (
          <DropBlock key={colorId} color={theme.blocks[colorId].base} delay={index * 110} />
        ))}
      </View>
      <Animated.View style={wordStyle}>
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>PULSE</Text>
        <Text style={[styles.sub, { color: theme.colors.accent }]}>BLOCKS</Text>
      </Animated.View>
    </View>
  );
}

function DropBlock({ color, delay }: { color: string; delay: number }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(delay, withSpring(1, { damping: 11, stiffness: 220 }));
  }, [delay, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateY: (1 - progress.value) * -60 },
      { scale: 0.7 + progress.value * 0.3 },
    ],
  }));

  return (
    <Animated.View style={[styles.block, { backgroundColor: color }, style]} />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.lg },
  row: { flexDirection: 'row', gap: SPACING.sm },
  block: { width: 34, height: 34, borderRadius: RADIUS.sm },
  title: {
    fontSize: FONT_SIZE.heading,
    fontWeight: FONT_WEIGHT.heavy,
    letterSpacing: 8,
    textAlign: 'center',
    marginRight: -8,
  },
  sub: {
    fontSize: FONT_SIZE.body,
    fontWeight: FONT_WEIGHT.heavy,
    letterSpacing: 10,
    textAlign: 'center',
    marginRight: -10,
  },
});
