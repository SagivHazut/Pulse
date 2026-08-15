import React, { memo } from 'react';
import { View } from 'react-native';

import type { BlockPalette } from '../../theme/themes';
import type { Piece } from '../../types';
import { Tile } from './Tile';

type Props = {
  piece: Piece;
  cellSize: number;
  gap: number;
  blocks: BlockPalette;
  emphasis?: number;
  opacity?: number;
};

export function pieceWidth(piece: Piece, cellSize: number, gap: number): number {
  return piece.width * cellSize + (piece.width - 1) * gap;
}

export function pieceHeight(piece: Piece, cellSize: number, gap: number): number {
  return piece.height * cellSize + (piece.height - 1) * gap;
}

/** Renders a piece's tiles at an arbitrary scale. Used by the tray and the drag layer. */
export const PieceShape = memo(function PieceShape({
  piece,
  cellSize,
  gap,
  blocks,
  emphasis = 0,
  opacity = 1,
}: Props) {
  const stride = cellSize + gap;
  return (
    <View
      style={{
        width: pieceWidth(piece, cellSize, gap),
        height: pieceHeight(piece, cellSize, gap),
        opacity,
      }}
      pointerEvents="none"
    >
      {piece.cells.map((cell) => (
        <Tile
          key={`${cell.r}:${cell.c}`}
          size={cellSize}
          skin={blocks[piece.colorId]}
          power={cell.power}
          emphasis={cell.power ? Math.max(0.9, emphasis) : emphasis}
          style={{ position: 'absolute', left: cell.c * stride, top: cell.r * stride }}
        />
      ))}
    </View>
  );
});
