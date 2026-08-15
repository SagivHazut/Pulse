import React, { memo, useEffect } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { ANIMATION } from '../../constants/config';
import type { BlockPalette, ThemeColors } from '../../theme/themes';
import { RADIUS } from '../../theme/tokens';
import type { CellState } from '../../types';
import { Tile } from './Tile';

type Props = {
  cell: CellState;
  size: number;
  left: number;
  top: number;
  colors: ThemeColors;
  blocks: BlockPalette;
  clearing: boolean;
  reducedMotion: boolean;
};

/**
 * One board square.
 *
 * Memoised on its own props so placing a piece re-renders the handful of cells
 * that changed, never the whole grid. The two animations it owns — a pop when it
 * fills and a burst when it clears — are driven by shared values, so they run on
 * the UI thread without another React pass.
 */
export const BoardCell = memo(
  function BoardCell({ cell, size, left, top, colors, blocks, clearing, reducedMotion }: Props) {
    const scale = useSharedValue(cell ? 1 : 0);
    const opacity = useSharedValue(cell ? 1 : 0);
    const filled = cell !== null;

    useEffect(() => {
      if (clearing) return;
      if (filled) {
        if (reducedMotion) {
          scale.value = 1;
          opacity.value = 1;
        } else {
          scale.value = withSpring(1, { damping: 12, stiffness: 320, mass: 0.6 });
          opacity.value = withTiming(1, { duration: 90 });
        }
      } else {
        scale.value = 0;
        opacity.value = 0;
      }
    }, [filled, clearing, reducedMotion, scale, opacity]);

    useEffect(() => {
      if (!clearing || !filled) return;
      if (reducedMotion) {
        opacity.value = withTiming(0, { duration: ANIMATION.clearTotalMs });
        return;
      }
      // Glow and swell first, then snap out — the anticipation is what makes a
      // clear read as an event rather than a deletion.
      scale.value = withSequence(
        withTiming(1.16, { duration: ANIMATION.clearAnticipationMs }),
        withTiming(0.1, { duration: ANIMATION.clearBurstMs }),
      );
      opacity.value = withDelay(
        ANIMATION.clearAnticipationMs,
        withTiming(0, { duration: ANIMATION.clearBurstMs }),
      );
    }, [clearing, filled, reducedMotion, scale, opacity]);

    const animatedStyle = useAnimatedStyle(() => ({
      opacity: opacity.value,
      transform: [{ scale: scale.value }],
    }));

    return (
      <>
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left,
            top,
            width: size,
            height: size,
            borderRadius: Math.max(4, Math.min(RADIUS.tile, size * 0.22)),
            backgroundColor: colors.gridCell,
            borderWidth: 1,
            borderColor: colors.gridLine,
          }}
        />
        {cell ? (
          <Animated.View
            pointerEvents="none"
            style={[{ position: 'absolute', left, top }, animatedStyle]}
          >
            <Tile
              size={size}
              skin={blocks[cell.colorId]}
              power={cell.power}
              emphasis={cell.power ? 0.9 : 0}
            />
          </Animated.View>
        ) : null}
      </>
    );
  },
  (prev, next) =>
    prev.cell === next.cell &&
    prev.size === next.size &&
    prev.left === next.left &&
    prev.top === next.top &&
    prev.clearing === next.clearing &&
    prev.colors === next.colors &&
    prev.blocks === next.blocks &&
    prev.reducedMotion === next.reducedMotion,
);
