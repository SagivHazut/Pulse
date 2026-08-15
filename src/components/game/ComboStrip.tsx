import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { COMBO_CONFIG } from '../../constants/config';
import { useTheme } from '../../hooks/useTheme';
import { FONT_SIZE, FONT_WEIGHT } from '../../theme/tokens';

type Props = { combo: number };

/**
 * Classic mode's stand-in for the Pulse meter.
 *
 * Combos are core scoring, not a power system, so Classic keeps them — it just
 * has no meter to fill. This reserves the same slice of vertical space the meter
 * occupies so the board and tray do not shift when switching modes, and stays
 * blank until there is actually a chain to report.
 */
export function ComboStrip({ combo }: Props) {
  const theme = useTheme();
  const active = combo >= 2;
  const hot = combo >= COMBO_CONFIG.hypeThreshold;

  return (
    <View style={styles.wrap}>
      {active ? (
        <>
          <Text style={[styles.label, { color: theme.colors.textMuted }]}>COMBO</Text>
          <Text
            style={[
              styles.value,
              { color: hot ? theme.colors.warning : theme.colors.accent },
            ]}
          >
            x{combo}
          </Text>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'stretch',
    height: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  label: { fontSize: FONT_SIZE.micro, fontWeight: FONT_WEIGHT.bold, letterSpacing: 1.6 },
  value: { fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.heavy },
});
