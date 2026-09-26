import React from 'react';
import { StyleSheet, Text } from 'react-native';

import { useTheme } from '../../hooks/useTheme';
import { FONT_SIZE, RADIUS } from '../../theme/tokens';
import { PressableScale } from './PressableScale';

type Common = {
  onPress: () => void;
  label: string;
  size?: number;
  tone?: 'default' | 'accent';
};

/**
 * Either a font glyph or a drawn icon, never both. The drawn form is a function
 * so the button can hand it the resolved tint — the tone-to-colour mapping lives
 * here, and duplicating it at every call site is how the two drift apart.
 */
type Props = Common &
  (
    | { glyph: string; icon?: never }
    | { glyph?: never; icon: (color: string) => React.ReactNode }
  );

/**
 * Small square control.
 *
 * Uses `surface` plus a hairline border rather than `surfaceSecondary`: on light
 * themes the secondary surface sits within a couple of percent of the background
 * and the button all but disappeared. `surface` contrasts in both modes, and the
 * border guarantees an edge even when it does not.
 */
export function IconButton({ glyph, icon, onPress, label, size = 42, tone = 'default' }: Props) {
  const theme = useTheme();
  const isAccent = tone === 'accent';
  const tint = isAccent ? theme.colors.accent : theme.colors.textSecondary;

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
        `includeFontPadding: false` is Android-only, and it matters: Roboto
        reserves ascent/descent padding inside the line box, so centring the Text
        centres that box rather than the glyph. Pinning lineHeight to the font
        size removes the remaining slack.

        It only gets the *box* right, though. A glyph the font draws off-centre
        inside its own em square stays off-centre — see {@link BackArrow} for the
        one that did, and had to stop being a glyph.
      */}
      {icon ? (
        icon(tint)
      ) : (
        <Text
          allowFontScaling={false}
          style={{
            color: tint,
            fontSize: FONT_SIZE.label,
            lineHeight: FONT_SIZE.label,
            includeFontPadding: false,
            textAlign: 'center',
            textAlignVertical: 'center',
          }}
        >
          {glyph}
        </Text>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
