import React, { memo } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { POWER_TILE_META } from '../../game/powerups/powerups';
import { useBlockFinish } from '../../hooks/useBlockFinish';
import type { BlockFinish } from '../../theme/finishes';
import type { BlockSkin } from '../../theme/themes';
import type { PowerType } from '../../types';

type Props = {
  size: number;
  skin: BlockSkin;
  power?: PowerType | null;
  /** 0–1 extra glow, used while dragging and on power tiles. */
  emphasis?: number;
  /** Force a finish instead of the player's selection. Used by the shop preview. */
  finish?: BlockFinish;
  style?: StyleProp<ViewStyle>;
};

/**
 * A single block face.
 *
 * Depth comes from cheap layers rather than an image: a dark base showing as a
 * bottom lip, the body colour, a soft top highlight, and a hairline inner glow.
 * No per-tile shadows — 64 of those would cost more than they are worth.
 *
 * The exact construction is driven by the player's chosen {@link BlockFinish}, so
 * the same palette can read as glossy, flat, moulded or hollow.
 */
export const Tile = memo(function Tile({
  size,
  skin,
  power,
  emphasis = 0,
  finish,
  style,
}: Props) {
  const selected = useBlockFinish();
  const f = finish ?? selected;

  const radius = Math.max(3, size * f.radiusRatio);
  const lip = f.lipRatio > 0 ? Math.max(2, size * f.lipRatio) : 0;

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: f.hollow ? 'transparent' : skin.dark,
        },
        style,
      ]}
    >
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          bottom: lip,
          borderRadius: radius,
          backgroundColor: f.hollow ? 'transparent' : skin.base,
          borderWidth: f.bodyBorderWidth,
          borderColor: f.hollow ? skin.base : 'rgba(255,255,255,0.16)',
          overflow: 'hidden',
        }}
      >
        {f.hollow ? (
          // A faint wash inside the ring so hollow tiles still read as filled
          // cells at a glance, rather than as empty ones.
          <View
            style={[StyleSheet.absoluteFill, { backgroundColor: skin.base, opacity: 0.22 }]}
          />
        ) : null}
      </View>

      {f.highlightOpacity > 0 ? (
        <View
          style={{
            position: 'absolute',
            left: Math.max(1, lip * 0.7),
            right: Math.max(1, lip * 0.7),
            top: Math.max(1, lip * 0.5),
            height: (size - lip) * f.highlightHeightRatio,
            borderRadius: radius * 0.8,
            backgroundColor: skin.light,
            opacity: f.highlightOpacity + emphasis * 0.25,
          }}
        />
      ) : null}

      {emphasis > 0 ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: -1,
            right: -1,
            top: -1,
            bottom: -1,
            borderRadius: radius + 1,
            borderWidth: 1.5,
            borderColor: skin.glow,
            opacity: emphasis,
          }}
        />
      ) : null}

      {power ? (
        <View style={styles.glyphWrap} pointerEvents="none">
          <Text
            style={{
              fontSize: size * 0.5,
              lineHeight: size * 0.58,
              color: '#FFFFFF',
              textShadowColor: 'rgba(0,0,0,0.45)',
              textShadowRadius: 3,
              textShadowOffset: { width: 0, height: 1 },
            }}
          >
            {POWER_TILE_META[power].glyph}
          </Text>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  glyphWrap: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
