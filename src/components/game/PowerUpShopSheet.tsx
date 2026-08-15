import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { POWER_UP_KINDS, POWER_UP_META } from '../../game/powerups/powerups';
import { BUNDLE, powerUpPrice } from '../../game/powerups/shop';
import { useTheme } from '../../hooks/useTheme';
import type { PowerUpInventory, PowerUpKind } from '../../types';
import { FONT_SIZE, FONT_WEIGHT, RADIUS, SPACING } from '../../theme/tokens';
import { PressableScale } from '../ui/PressableScale';
import { Sheet } from '../ui/Sheet';

type Props = {
  visible: boolean;
  onClose: () => void;
  inventory: PowerUpInventory;
  coins: number;
  onBuy: (kind: PowerUpKind, quantity: number) => void;
  /** Rewarded-ad alternative. Omitted once used for the session. */
  onWatchAd?: () => void;
  adAvailable: boolean;
  busy: boolean;
};

/**
 * Where power-ups come from.
 *
 * Both routes live here on purpose — coins and the rewarded ad — so the player
 * compares them side by side instead of meeting the ad alone at a moment of
 * frustration. The free option is listed first for exactly that reason.
 */
export function PowerUpShopSheet({
  visible,
  onClose,
  inventory,
  coins,
  onBuy,
  onWatchAd,
  adAvailable,
  busy,
}: Props) {
  const theme = useTheme();
  const [pending, setPending] = useState<PowerUpKind | null>(null);

  const buy = useCallback(
    (kind: PowerUpKind, quantity: number) => {
      setPending(kind);
      onBuy(kind, quantity);
      setPending(null);
    },
    [onBuy],
  );

  return (
    <Sheet visible={visible} onClose={onClose} title="Power-ups">
      <View style={styles.balance}>
        <Text style={{ color: theme.colors.coin, fontSize: FONT_SIZE.body }}>◉</Text>
        <Text
          style={{
            color: theme.colors.textPrimary,
            fontSize: FONT_SIZE.label,
            fontWeight: FONT_WEIGHT.heavy,
          }}
        >
          {coins.toLocaleString()}
        </Text>
        <Text style={{ color: theme.colors.textMuted, fontSize: FONT_SIZE.caption }}>
          earned by playing
        </Text>
      </View>

      {adAvailable && onWatchAd ? (
        <PressableScale
          onPress={onWatchAd}
          disabled={busy}
          haptic="medium"
          accessibilityLabel="Watch an ad for a free power-up"
          style={[
            styles.adRow,
            { backgroundColor: theme.colors.surfaceSecondary, borderColor: theme.colors.warning },
          ]}
        >
          <Text style={{ color: theme.colors.warning, fontSize: FONT_SIZE.body }}>▶</Text>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: theme.colors.textPrimary,
                fontSize: FONT_SIZE.body,
                fontWeight: FONT_WEIGHT.bold,
              }}
            >
              Watch an ad — free power-up
            </Text>
            <Text style={{ color: theme.colors.textMuted, fontSize: FONT_SIZE.micro }}>
              Once per session · Bomb or Bolt
            </Text>
          </View>
        </PressableScale>
      ) : null}

      {POWER_UP_KINDS.map((kind) => {
        const meta = POWER_UP_META[kind];
        const single = powerUpPrice(kind, 1);
        const bundle = powerUpPrice(kind, BUNDLE.quantity);
        const owned = inventory[kind];
        const disabled = busy || pending === kind;

        return (
          <View
            key={kind}
            style={[styles.row, { backgroundColor: theme.colors.surfaceSecondary }]}
          >
            <View style={[styles.glyphBox, { backgroundColor: theme.colors.surface }]}>
              <Text style={{ fontSize: FONT_SIZE.title, color: theme.colors.accent }}>
                {meta.glyph}
              </Text>
            </View>

            <View style={styles.info}>
              <View style={styles.nameRow}>
                <Text
                  style={{
                    color: theme.colors.textPrimary,
                    fontSize: FONT_SIZE.body,
                    fontWeight: FONT_WEIGHT.bold,
                  }}
                >
                  {meta.label}
                </Text>
                <Text style={{ color: theme.colors.textMuted, fontSize: FONT_SIZE.micro }}>
                  {owned > 0 ? `you have ${owned}` : ''}
                </Text>
              </View>
              <Text
                numberOfLines={1}
                style={{ color: theme.colors.textMuted, fontSize: FONT_SIZE.micro }}
              >
                {meta.hint}
              </Text>

              <View style={styles.buyRow}>
                <BuyButton
                  label={`◉ ${single.toLocaleString()}`}
                  caption="×1"
                  affordable={coins >= single}
                  disabled={disabled}
                  onPress={() => buy(kind, 1)}
                  accessibilityLabel={`Buy one ${meta.label} for ${single} coins`}
                />
                <BuyButton
                  label={`◉ ${bundle.toLocaleString()}`}
                  caption={`×${BUNDLE.quantity} · save ${Math.round(BUNDLE.discount * 100)}%`}
                  affordable={coins >= bundle}
                  disabled={disabled}
                  onPress={() => buy(kind, BUNDLE.quantity)}
                  accessibilityLabel={`Buy ${BUNDLE.quantity} ${meta.label} for ${bundle} coins`}
                />
              </View>
            </View>
          </View>
        );
      })}

      <Text style={[styles.footnote, { color: theme.colors.textMuted }]}>
        Coins are only ever earned by playing — nothing here is for sale for money.
      </Text>
    </Sheet>
  );
}

function BuyButton({
  label,
  caption,
  affordable,
  disabled,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  caption: string;
  affordable: boolean;
  disabled: boolean;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  const theme = useTheme();
  const usable = affordable && !disabled;

  return (
    <PressableScale
      onPress={onPress}
      disabled={!usable}
      haptic="medium"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !usable }}
      style={[
        styles.buy,
        {
          backgroundColor: usable ? theme.colors.accent : theme.colors.surface,
          borderColor: usable ? theme.colors.accent : theme.colors.gridLine,
          opacity: affordable ? 1 : 0.5,
        },
      ]}
    >
      <Text
        style={{
          color: usable ? theme.colors.accentContrast : theme.colors.textMuted,
          fontSize: FONT_SIZE.caption,
          fontWeight: FONT_WEIGHT.heavy,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          color: usable ? theme.colors.accentContrast : theme.colors.textMuted,
          fontSize: 9,
          fontWeight: FONT_WEIGHT.bold,
          opacity: 0.8,
        }}
      >
        {caption}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  balance: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    marginTop: -SPACING.xs,
  },
  adRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
  },
  row: {
    flexDirection: 'row',
    gap: SPACING.sm,
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
  },
  glyphBox: {
    width: 46,
    height: 46,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  buyRow: { flexDirection: 'row', gap: SPACING.xs, marginTop: 4 },
  buy: {
    flex: 1,
    minHeight: 40,
    borderRadius: RADIUS.sm,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
  },
  footnote: { textAlign: 'center', fontSize: FONT_SIZE.micro, marginTop: -SPACING.xs },
});
