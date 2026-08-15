import React, { useCallback } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { ANIMATION } from '../../constants/config';
import { playSfx } from '../../services/audio';
import { haptics } from '../../services/haptics';
import { isReducedMotion } from '../../stores/useSettingsStore';
import { HIT_SLOP, MIN_TAP_TARGET } from '../../theme/tokens';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type PressableScaleProps = PressableProps & {
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  /** Play the tap sound. Off for controls with their own sound. */
  sound?: boolean;
  haptic?: 'none' | 'light' | 'medium' | 'selection';
  scaleTo?: number;
};

/**
 * The only button primitive in the app.
 *
 * Nothing in the UI should feel static: every press scales down, ticks a haptic
 * and plays a click, all of it honouring the accessibility toggles.
 */
export function PressableScale({
  style,
  children,
  sound = true,
  haptic = 'light',
  scaleTo = ANIMATION.buttonPressScale,
  disabled,
  onPressIn,
  onPressOut,
  onPress,
  ...rest
}: PressableScaleProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback<NonNullable<PressableProps['onPressIn']>>(
    (event) => {
      if (!disabled) {
        scale.value = isReducedMotion()
          ? withTiming(scaleTo, { duration: 60 })
          : withSpring(scaleTo, { damping: 18, stiffness: 420 });
        if (haptic === 'light') haptics.light();
        else if (haptic === 'medium') haptics.medium();
        else if (haptic === 'selection') haptics.selection();
      }
      onPressIn?.(event);
    },
    [disabled, haptic, onPressIn, scale, scaleTo],
  );

  const handlePressOut = useCallback<NonNullable<PressableProps['onPressOut']>>(
    (event) => {
      scale.value = isReducedMotion()
        ? withTiming(1, { duration: 60 })
        : withSpring(1, { damping: 14, stiffness: 380 });
      onPressOut?.(event);
    },
    [onPressOut, scale],
  );

  const handlePress = useCallback<NonNullable<PressableProps['onPress']>>(
    (event) => {
      if (disabled) return;
      if (sound) playSfx('tap');
      onPress?.(event);
    },
    [disabled, onPress, sound],
  );

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      hitSlop={rest.hitSlop ?? HIT_SLOP}
      accessibilityRole={rest.accessibilityRole ?? 'button'}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      style={[{ minHeight: MIN_TAP_TARGET, justifyContent: 'center' }, animatedStyle, style]}
    >
      {children}
    </AnimatedPressable>
  );
}
