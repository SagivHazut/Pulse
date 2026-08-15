import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { useTheme } from '../../hooks/useTheme';
import { FONT_SIZE, FONT_WEIGHT, RADIUS, SPACING } from '../../theme/tokens';
import { PressableScale } from './PressableScale';

type Props = {
  label: string;
  description?: string;
  value: boolean;
  onChange: (value: boolean) => void;
};

export function Toggle({ label, description, value, onChange }: Props) {
  const theme = useTheme();
  const knob = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    knob.value = withSpring(value ? 1 : 0, { damping: 16, stiffness: 260 });
  }, [value, knob]);

  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: knob.value * 22 }],
  }));
  const trackStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + knob.value * 0.65,
  }));

  return (
    <PressableScale
      onPress={() => onChange(!value)}
      haptic="selection"
      scaleTo={0.985}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      accessibilityHint={description}
      style={styles.row}
    >
      <View style={styles.text}>
        <Text style={[styles.label, { color: theme.colors.textPrimary }]}>{label}</Text>
        {description ? (
          <Text style={[styles.description, { color: theme.colors.textMuted }]}>
            {description}
          </Text>
        ) : null}
      </View>

      <Animated.View
        style={[
          styles.track,
          {
            backgroundColor: value ? theme.colors.accent : theme.colors.surfaceSecondary,
          },
          trackStyle,
        ]}
      >
        <Animated.View
          style={[
            styles.knob,
            { backgroundColor: value ? theme.colors.accentContrast : theme.colors.textMuted },
            knobStyle,
          ]}
        />
      </Animated.View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  text: { flex: 1, gap: 2 },
  label: { fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold },
  description: { fontSize: FONT_SIZE.caption },
  track: {
    width: 50,
    height: 28,
    borderRadius: RADIUS.pill,
    padding: 3,
    justifyContent: 'center',
  },
  knob: { width: 22, height: 22, borderRadius: 11 },
});
