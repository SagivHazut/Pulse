import React from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { useTheme } from '../../hooks/useTheme';
import { ELEVATION } from '../../theme/tokens';
import { useDragContext } from './DragContext';
import { PieceShape, pieceHeight, pieceWidth } from './PieceShape';

/**
 * Renders the piece currently in the air, above everything else.
 *
 * Living at the root of the screen rather than inside the tray means the piece
 * can never be clipped by a parent's bounds — a real problem on Android — and
 * always paints over the board.
 */
export function DragLayer() {
  const theme = useTheme();
  const { draggingPiece, motion, metrics } = useDragContext();

  const piece = draggingPiece;
  const width = piece ? pieceWidth(piece, metrics.cellSize, metrics.gap) : 0;
  const height = piece ? pieceHeight(piece, metrics.cellSize, metrics.gap) : 0;

  const style = useAnimatedStyle(() => ({
    opacity: motion.active.value,
    transform: [
      { translateX: motion.centerX.value - width / 2 + motion.wobble.value * 7 },
      { translateY: motion.centerY.value - height / 2 },
      { scale: motion.scale.value },
      { rotateZ: `${motion.wobble.value * 2.5}deg` },
    ],
  }));

  if (!piece) return null;

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.layer]}>
      <Animated.View style={[styles.piece, ELEVATION.dragging, style]}>
        <PieceShape
          piece={piece}
          cellSize={metrics.cellSize}
          gap={metrics.gap}
          blocks={theme.blocks}
          emphasis={0.5}
        />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  layer: { zIndex: 1000, elevation: 1000 },
  piece: { position: 'absolute', left: 0, top: 0 },
});
