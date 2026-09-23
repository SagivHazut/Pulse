import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { GAME_CONFIG } from '../../constants/config';
import { findCompletedLines } from '../../game/engine/lines';
import { placePiece } from '../../game/engine/placement';
import { useTheme } from '../../hooks/useTheme';
import { coordKey } from '../../game/engine/board';
import { cellUnderTap } from '../../game/dragMath';
import { RADIUS } from '../../theme/tokens';
import type { Board as BoardType, Coord, Piece, PowerUpKind } from '../../types';
import type { BoardMetrics } from '../../utils/layout';
import { BoardCell } from './BoardCell';
import type { PreviewState } from './DragContext';
import { Tile } from './Tile';

type Props = {
  board: BoardType;
  clearingCells: readonly Coord[];
  metrics: BoardMetrics;
  preview: PreviewState | null;
  draggingPiece: Piece | null;
  tension: number;
  armedPowerUp: PowerUpKind | null;
  reducedMotion: boolean;
  onGridLayout: () => void;
  onCellPress: (coord: Coord) => void;
  gridRef: React.RefObject<View | null>;
};

const ROWS = GAME_CONFIG.rows;
const COLUMNS = GAME_CONFIG.columns;

export function Board({
  board,
  clearingCells,
  metrics,
  preview,
  draggingPiece,
  tension,
  armedPowerUp,
  reducedMotion,
  onGridLayout,
  onCellPress,
  gridRef,
}: Props) {
  const theme = useTheme();
  const { cellSize, cellStride, padding, boardSize } = metrics;

  const clearingKeys = useMemo(() => {
    const set = new Set<string>();
    for (const c of clearingCells) set.add(coordKey(c.row, c.col));
    return set;
  }, [clearingCells]);

  /**
   * Lines the current preview would complete. Recomputed only when the snapped
   * target changes, so this never runs during a drag frame.
   */
  const completing = useMemo(() => {
    if (!preview?.valid || !draggingPiece) return null;
    try {
      const next = placePiece(board, draggingPiece, preview.row, preview.col).board;
      const lines = findCompletedLines(next);
      if (lines.rows.length === 0 && lines.cols.length === 0) return null;
      return lines;
    } catch {
      return null;
    }
  }, [board, draggingPiece, preview]);

  // --- tension pulse -------------------------------------------------------
  const pulse = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(pulse);
    if (tension <= 0 || reducedMotion) {
      pulse.value = withTiming(0, { duration: 300 });
      return;
    }
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900 - tension * 350, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.15, { duration: 900 - tension * 350, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(pulse);
  }, [tension, reducedMotion, pulse]);

  const tensionStyle = useAnimatedStyle(() => ({
    opacity: pulse.value * tension * 0.75,
  }));

  // --- power-up targeting --------------------------------------------------
  const lastTap = useRef(0);
  const handlePress = useCallback(
    (event: GestureResponderEvent) => {
      if (!armedPowerUp) return;
      const now = Date.now();
      if (now - lastTap.current < 220) return;
      lastTap.current = now;

      const { locationX, locationY } = event.nativeEvent;
      // Relative to the targeting overlay, which is already inset by `padding` —
      // so the cells inside it start at 0. See `cellUnderTap`.
      const target = cellUnderTap(locationX, locationY, cellStride, ROWS, COLUMNS);
      if (!target) return;
      onCellPress(target);
    },
    [armedPowerUp, cellStride, onCellPress],
  );

  const ghostCells = useMemo(() => {
    if (!preview || !draggingPiece) return [];
    return (
      draggingPiece.cells
        // `r`/`c` are the cell's offset *within the piece*, carried through so the
        // ghost can be keyed by it. Keying by absolute board position instead
        // changed every key each time the piece crossed a cell boundary, so React
        // tore down and rebuilt every ghost view ~20 times a second mid-drag
        // instead of updating two numbers on each.
        .map((cell) => ({
          r: cell.r,
          c: cell.c,
          row: preview.row + cell.r,
          col: preview.col + cell.c,
          power: cell.power,
        }))
        .filter((c) => c.row >= 0 && c.col >= 0 && c.row < ROWS && c.col < COLUMNS)
    );
  }, [preview, draggingPiece]);

  return (
    <View
      style={[
        styles.frame,
        {
          width: boardSize,
          height: boardSize,
          borderRadius: RADIUS.xl,
          backgroundColor: theme.colors.boardBackground,
          borderColor: theme.colors.gridLine,
        },
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: RADIUS.xl,
            borderWidth: 2,
            borderColor: theme.colors.danger,
          },
          tensionStyle,
        ]}
      />

      <Pressable
        ref={gridRef}
        onLayout={onGridLayout}
        onPress={handlePress}
        collapsable={false}
        disabled={!armedPowerUp}
        // Fully transparent to touch unless a power-up is waiting for a target,
        // so nothing here can ever swallow a drag.
        pointerEvents={armedPowerUp && armedPowerUp !== 'shuffle' ? 'auto' : 'box-none'}
        accessibilityRole={armedPowerUp ? 'button' : 'none'}
        accessibilityLabel={armedPowerUp ? 'Game board. Tap a cell to use your power-up' : 'Game board'}
        style={{ position: 'absolute', left: padding, top: padding, right: padding, bottom: padding }}
      >
        {board.map((row, r) =>
          row.map((cell, c) => (
            <BoardCell
              key={`${r}:${c}`}
              cell={cell}
              size={cellSize}
              left={c * cellStride}
              top={r * cellStride}
              colors={theme.colors}
              blocks={theme.blocks}
              clearing={clearingKeys.has(coordKey(r, c))}
              reducedMotion={reducedMotion}
            />
          )),
        )}

        {/* Lines this drop would complete — the strongest signal on the board. */}
        {/*
          Keyed by slot, not by row: these are plain stateless Views, so reusing
          the slot moves an existing view instead of unmounting one and mounting
          another every time the hovered piece shifts.
        */}
        {completing?.rows.map((r, slot) => (
          <View
            key={`hl-row-${slot}`}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: -2,
              top: r * cellStride - 2,
              width: COLUMNS * cellStride - metrics.gap + 4,
              height: cellSize + 4,
              borderRadius: RADIUS.sm,
              backgroundColor: theme.colors.accentSoft,
              borderWidth: 1.5,
              borderColor: theme.colors.accent,
            }}
          />
        ))}
        {completing?.cols.map((c, slot) => (
          <View
            key={`hl-col-${slot}`}
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: -2,
              left: c * cellStride - 2,
              height: ROWS * cellStride - metrics.gap + 4,
              width: cellSize + 4,
              borderRadius: RADIUS.sm,
              backgroundColor: theme.colors.accentSoft,
              borderWidth: 1.5,
              borderColor: theme.colors.accent,
            }}
          />
        ))}

        {/* Placement ghost. Invalid is marked by shape as well as colour. */}
        {ghostCells.map((cell) =>
          preview?.valid ? (
            <View
              key={`ghost-${cell.r}-${cell.c}`}
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: cell.col * cellStride,
                top: cell.row * cellStride,
                opacity: 0.55,
              }}
            >
              <Tile
                size={cellSize}
                skin={theme.blocks[draggingPiece?.colorId ?? 'aqua']}
                power={cell.power}
                emphasis={1}
              />
            </View>
          ) : (
            <View
              key={`ghost-${cell.r}-${cell.c}`}
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: cell.col * cellStride,
                top: cell.row * cellStride,
                width: cellSize,
                height: cellSize,
                borderRadius: Math.max(4, cellSize * 0.22),
                backgroundColor: theme.colors.ghostInvalid,
                borderWidth: 2,
                borderStyle: 'dashed',
                borderColor: theme.colors.danger,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: theme.colors.danger, fontSize: cellSize * 0.45 }}>✕</Text>
            </View>
          ),
        )}

        {/* Targeting grid for an armed power-up. */}
        {armedPowerUp && armedPowerUp !== 'shuffle' ? (
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              {
                borderRadius: RADIUS.lg,
                borderWidth: 2,
                borderColor: theme.colors.warning,
                backgroundColor: 'rgba(255,193,94,0.08)',
              },
            ]}
          />
        ) : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderWidth: 1,
    overflow: 'visible',
  },
});
