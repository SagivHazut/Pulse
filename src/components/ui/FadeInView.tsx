import React, { useEffect } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { isReducedMotion } from '../../stores/useSettingsStore';

type Props = {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  /** Distance to travel on the way in. Negative slides down from above. */
  offsetY?: number;
  offsetX?: number;
  style?: StyleProp<ViewStyle>;
  pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only';
};

/**
 * Mount-in animation.
 *
 * Deliberately a plain animated style rather than Reanimated's `entering`
 * layout animation: layout animations are not reliable across every platform
 * this app targets, and a container stuck at opacity 0 is a blank screen, not a
 * missing flourish. This is boring on purpose.
 */
export function FadeInView({
  children,
  delay = 0,
  duration = 340,
  offsetY = 12,
  offsetX = 0,
  style,
  pointerEvents,
}: Props) {
  const progress = useSharedValue(0);

  useEffect(() => {
    const reduced = isReducedMotion();
    progress.value = reduced
      ? 1
      : withDelay(delay, withTiming(1, { duration, easing: Easing.out(Easing.cubic) }));
  }, [delay, duration, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateY: (1 - progress.value) * offsetY },
      { translateX: (1 - progress.value) * offsetX },
    ],
  }));

  return (
    <Animated.View style={[style, animatedStyle]} pointerEvents={pointerEvents}>
      {children}
    </Animated.View>
  );
}
