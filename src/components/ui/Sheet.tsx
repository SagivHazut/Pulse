import React, { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../hooks/useTheme';
import { isReducedMotion } from '../../stores/useSettingsStore';
import { ELEVATION, FONT_SIZE, FONT_WEIGHT, RADIUS, SPACING } from '../../theme/tokens';

type Props = {
  visible: boolean;
  onClose?: () => void;
  title?: string;
  /** Dismissable sheets close on backdrop tap; blocking ones do not. */
  dismissable?: boolean;
  children: React.ReactNode;
};

/**
 * Bottom sheet used for settings, the daily reward and game over.
 *
 * The entrance is a plain animated style rather than a Reanimated layout
 * animation — same reasoning as FadeInView: a sheet that fails to animate in
 * must still be a visible sheet.
 */
export function Sheet({ visible, onClose, title, dismissable = true, children }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!visible) {
      progress.value = 0;
      return;
    }
    progress.value = isReducedMotion()
      ? withTiming(1, { duration: 120 })
      : withSpring(1, { damping: 22, stiffness: 240, mass: 0.9 });
  }, [visible, progress]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 260 }],
  }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={dismissable ? onClose : undefined}
    >
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.overlay }, backdropStyle]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={dismissable ? onClose : undefined}
          accessibilityLabel={dismissable ? 'Close' : undefined}
          accessibilityRole={dismissable ? 'button' : 'none'}
        />
      </Animated.View>

      <View style={styles.container} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.sheet,
            ELEVATION.card,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.gridLine,
              paddingBottom: Math.max(insets.bottom, SPACING.lg),
            },
            sheetStyle,
          ]}
        >
          <View style={[styles.grabber, { backgroundColor: theme.colors.textMuted }]} />
          {title ? (
            <Text style={[styles.title, { color: theme.colors.textPrimary }]}>{title}</Text>
          ) : null}
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    borderWidth: 1,
    paddingTop: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    gap: SPACING.md,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    opacity: 0.35,
    marginBottom: SPACING.xs,
  },
  title: {
    fontSize: FONT_SIZE.title,
    fontWeight: FONT_WEIGHT.heavy,
    textAlign: 'center',
  },
});
