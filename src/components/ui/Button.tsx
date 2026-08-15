import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../../hooks/useTheme';
import { ELEVATION, FONT_SIZE, FONT_WEIGHT, RADIUS, SPACING } from '../../theme/tokens';
import { PressableScale } from './PressableScale';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'reward';
export type ButtonSize = 'sm' | 'md' | 'lg';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: string;
  /** Small caption under the label — used by the rewarded-ad CTA. */
  caption?: string;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
};

const SIZES: Record<ButtonSize, { padV: number; padH: number; font: number; radius: number }> = {
  sm: { padV: 10, padH: SPACING.md, font: FONT_SIZE.caption, radius: RADIUS.sm },
  md: { padV: 14, padH: SPACING.lg, font: FONT_SIZE.label, radius: RADIUS.md },
  lg: { padV: 18, padH: SPACING.lg, font: FONT_SIZE.title, radius: RADIUS.lg },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  caption,
  disabled = false,
  fullWidth = false,
  style,
  accessibilityHint,
}: Props) {
  const theme = useTheme();
  const dims = SIZES[size];

  const palette: Record<ButtonVariant, { bg: string; fg: string; border?: string }> = {
    primary: { bg: theme.colors.accent, fg: theme.colors.accentContrast },
    secondary: {
      bg: theme.colors.surfaceSecondary,
      fg: theme.colors.textPrimary,
      border: theme.colors.gridLine,
    },
    ghost: { bg: 'transparent', fg: theme.colors.textSecondary },
    reward: { bg: theme.colors.warning, fg: '#2A1A00' },
  };
  const colors = palette[variant];

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      haptic={variant === 'primary' || variant === 'reward' ? 'medium' : 'light'}
      accessibilityLabel={caption ? `${label}. ${caption}` : label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      style={[
        styles.base,
        {
          backgroundColor: colors.bg,
          borderRadius: dims.radius,
          paddingVertical: dims.padV,
          paddingHorizontal: dims.padH,
          borderWidth: colors.border ? 1 : 0,
          borderColor: colors.border,
          opacity: disabled ? 0.45 : 1,
          alignSelf: fullWidth ? 'stretch' : 'center',
        },
        variant !== 'ghost' && ELEVATION.card,
        style,
      ]}
    >
      <View style={styles.row}>
        {icon ? (
          <Text style={[styles.icon, { color: colors.fg, fontSize: dims.font }]}>{icon}</Text>
        ) : null}
        <Text
          numberOfLines={1}
          /**
           * Shrink rather than truncate.
           *
           * A single line at a fixed size turns "PLAY · QUICK TUTORIAL" into
           * "PLAY · QUICK TUTO…" on a 320dp-wide phone — the primary call to
           * action, unreadable. The floor stops it shrinking so far that the
           * button stops looking like the loudest thing on screen.
           */
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          style={{
            color: colors.fg,
            fontSize: dims.font,
            fontWeight: FONT_WEIGHT.heavy,
            letterSpacing: 0.6,
            textAlign: 'center',
          }}
        >
          {label}
        </Text>
      </View>
      {caption ? (
        <Text
          style={[styles.caption, { color: colors.fg }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
        >
          {caption}
        </Text>
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  icon: {
    fontWeight: '700',
  },
  caption: {
    marginTop: 2,
    fontSize: FONT_SIZE.micro,
    fontWeight: FONT_WEIGHT.medium,
    opacity: 0.75,
  },
});
