import React from 'react';
import { StyleSheet, Text } from 'react-native';

import { useTheme } from '../../hooks/useTheme';
import { FONT_SIZE, RADIUS } from '../../theme/tokens';
import { PressableScale } from './PressableScale';

type Props = {
  glyph: string;
  onPress: () => void;
  label: string;
  size?: number;
  tone?: 'default' | 'accent';
};

/**
 * Small square control.
 *
 * Uses `surface` plus a hairline border rather than `surfaceSecondary`: on light
 * themes the secondary surface sits within a couple of percent of the background
 * and the button all but disappeared. `surface` contrasts in both modes, and the
 * border guarantees an edge even when it does not.
 */
export function IconButton({ glyph, onPress, label, size = 42, tone = 'default' }: Props) {
  const theme = useTheme();
  const isAccent = tone === 'accent';

  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={label}
      style={[
        styles.base,
        {
          width: size,
          height: size,
          minHeight: size,
          borderRadius: RADIUS.md,
          backgroundColor: isAccent ? theme.colors.accentSoft : theme.colors.surface,
          borderWidth: 1,
          borderColor: isAccent ? theme.colors.accent : theme.colors.gridLine,
        },
      ]}
    >
      {/*
        `includeFontPadding: false` is the fix, and it is Android-only.
        Roboto reserves ascent/descent padding inside the line box, so centring
        the Text centres that box rather than the glyph — an arrow, whose optical
        mass sits high, ends up visibly above centre. Pinning lineHeight to the
        font size removes the remaining slack so the glyph sits dead centre on
        both platforms.
      */}
      <Text
        allowFontScaling={false}
        style={{
          color: isAccent ? theme.colors.accent : theme.colors.textSecondary,
          fontSize: FONT_SIZE.label,
          lineHeight: FONT_SIZE.label,
          includeFontPadding: false,
          textAlign: 'center',
          textAlignVertical: 'center',
        }}
      >
        {glyph}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
