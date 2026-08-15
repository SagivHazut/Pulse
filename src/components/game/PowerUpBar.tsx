import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { POWER_UP_KINDS, POWER_UP_META } from '../../game/powerups/powerups';
import { useTheme } from '../../hooks/useTheme';
import { FONT_SIZE, FONT_WEIGHT, RADIUS, SPACING } from '../../theme/tokens';
import type { PowerUpInventory, PowerUpKind } from '../../types';
import { PressableScale } from '../ui/PressableScale';

type Props = {
  inventory: PowerUpInventory;
  armed: PowerUpKind | null;
  onSelect: (kind: PowerUpKind) => void;
  /** Opens the shop. Also used when tapping a slot the player has none of. */
  onOpenShop: () => void;
};

/**
 * The bottom toolbar. Deliberately small and quiet: it should read as an option,
 * not a demand.
 *
 * Tapping a slot you have none of opens the shop rather than doing nothing — the
 * moment you reach for a power-up you do not have is exactly when buying one is
 * useful. Owned slots still arm on tap.
 */
export function PowerUpBar({ inventory, armed, onSelect, onOpenShop }: Props) {
  const theme = useTheme();

  return (
    <View style={styles.wrap}>
      {POWER_UP_KINDS.map((kind) => {
        const count = inventory[kind];
        const meta = POWER_UP_META[kind];
        const isArmed = armed === kind;
        const usable = count > 0;

        return (
          <PressableScale
            key={kind}
            onPress={() => (usable ? onSelect(kind) : onOpenShop())}
            sound={false}
            haptic="none"
            accessibilityLabel={`${meta.label}, ${count} available`}
            accessibilityHint={usable ? meta.hint : `Tap to buy. ${meta.hint}`}
            accessibilityState={{ selected: isArmed }}
            style={[
              styles.slot,
              {
                backgroundColor: isArmed ? theme.colors.accentSoft : theme.colors.surface,
                borderColor: isArmed ? theme.colors.accent : theme.colors.gridLine,
                opacity: usable ? 1 : 0.55,
              },
            ]}
          >
            <Text
              style={{
                fontSize: FONT_SIZE.label,
                color: isArmed ? theme.colors.accent : theme.colors.textSecondary,
              }}
            >
              {meta.glyph}
            </Text>
            <Text
              style={{
                fontSize: FONT_SIZE.micro,
                fontWeight: FONT_WEIGHT.bold,
                color: theme.colors.textMuted,
              }}
            >
              {meta.label}
            </Text>
            {count > 0 ? (
              <View style={[styles.count, { backgroundColor: theme.colors.accent }]}>
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: FONT_WEIGHT.heavy,
                    color: theme.colors.accentContrast,
                  }}
                >
                  {count}
                </Text>
              </View>
            ) : null}
          </PressableScale>
        );
      })}

      <PressableScale
        onPress={onOpenShop}
        sound={false}
        accessibilityLabel="Power-up shop"
        style={[
          styles.shop,
          { backgroundColor: theme.colors.surface, borderColor: theme.colors.gridLine },
        ]}
      >
        <Text style={{ fontSize: FONT_SIZE.label, color: theme.colors.textSecondary }}>＋</Text>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
  },
  slot: {
    width: 66,
    height: 52,
    minHeight: 52,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  count: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shop: {
    width: 46,
    height: 52,
    minHeight: 52,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
