import React, { useCallback, useMemo } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
  runOnJS,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import {
  canPlaceOnGrid,
  cellUnderPiece,
  isOffBoard,
  shouldReleaseDragLayer,
} from '../../game/dragMath';
import { useTheme } from '../../hooks/useTheme';
import { playSfx } from '../../services/audio';
import { haptics } from '../../services/haptics';
import { ELEVATION } from '../../theme/tokens';
import type { Piece } from '../../types';
import { useDragContext } from './DragContext';
import { PieceShape, pieceHeight, pieceWidth } from './PieceShape';

type Props = {
  piece: Piece;
  /** Which tray slot this piece sits in. Slots outlive pieces. */
  slotIndex: number;
  /** Measured centres of the tray slots, owned by {@link PieceTray}. */
  slotCenters: SharedValue<{ x: number; y: number }[]>;
  slotSize: number;
  /** True when no placement exists for this piece — it renders dimmed. */
  dead: boolean;
};

/**
 * A piece in the tray, and the gesture that lifts it out.
 *
 * Performance shape:
 *  - The airborne piece follows the finger through shared values only. No React
 *    state is touched while dragging, so the gesture never waits on a render.
 *  - Validity is evaluated in a worklet against a flat 0/1 mirror of the board.
 *  - The JS thread only hears about the drag when the snapped target cell
 *    changes, which drives the ghost and the completing-line highlight.
 */
export function DraggablePiece({ piece, slotIndex, slotCenters, slotSize, dead }: Props) {
  const theme = useTheme();
  const {
    metrics,
    rows,
    columns,
    boardOrigin,
    rootOrigin,
    occupancy,
    motion,
    setPreview,
    setDraggingPiece,
    draggingPiece,
    onDrop,
    onInvalidDrop,
    enabled,
  } = useDragContext();

  /**
   * Which drag this piece owns. The fly-home animation's completion callback
   * compares this against the live session, so a return that lands late can
   * never clean up a *different* piece's drag.
   *
   * It lives on the piece, not on the drag, so it cannot catch a re-grab of
   * this same piece — `onBegin` has already bumped it by the time a cancelled
   * flight calls back. That case is caught by the animation's `finished` flag.
   * See `shouldReleaseDragLayer`.
   */
  const dragId = useSharedValue(0);

  // Last reported target, so we only cross the bridge when it actually changes.
  const lastRow = useSharedValue(-999);
  const lastCol = useSharedValue(-999);
  const lastValid = useSharedValue(-1);

  const { cellSize, gap, cellStride: stride } = metrics;
  // A plain number, so the gesture worklets below capture the value rather
  // than the metrics object.
  const trayScale = metrics.trayScale;
  const fullWidth = pieceWidth(piece, cellSize, gap);
  const fullHeight = pieceHeight(piece, cellSize, gap);

  /** Plain data captured by the worklet — no class instances, no React closures. */
  const shape = useMemo(
    () => piece.cells.map((c) => ({ r: c.r, c: c.c, wild: c.power === 'rainbow' ? 1 : 0 })),
    [piece.cells],
  );

  /** Lift the piece above the finger so the hand never covers it. */
  const liftAmount = Math.max(cellSize * 1.35, 56);
  const isAirborne = draggingPiece?.id === piece.id;

  const beginDrag = useCallback(() => {
    playSfx('pickup');
    haptics.light();
    setDraggingPiece(piece);
  }, [piece, setDraggingPiece]);

  /**
   * Safe to call from a stale animation: it only relinquishes the drag layer if
   * this piece still owns it, so a cancelled fly-home can never cancel a newer
   * drag that has already taken over.
   */
  const endDrag = useCallback(() => {
    setDraggingPiece((current) => (current?.id === piece.id ? null : current));
    setPreview(null);
  }, [piece.id, setDraggingPiece, setPreview]);

  const commit = useCallback(
    (row: number, col: number) => onDrop(piece.id, row, col),
    [onDrop, piece.id],
  );

  const pan = useMemo(() => {
    const pieceSize = { width: fullWidth, height: fullHeight };

    /** Move the drag layer and return the grid cell the piece is hovering. */
    const track = (tx: number, ty: number) => {
      'worklet';
      const slot = slotCenters.value[slotIndex];
      if (!slot || (slot.x === 0 && slot.y === 0)) {
        // Not laid out yet: report a target far off the board rather than a
        // plausible-looking wrong one.
        return { row: -999, col: -999 };
      }
      const centerX = slot.x + tx;
      const centerY = slot.y + ty - liftAmount;
      motion.centerX.value = centerX - rootOrigin.value.x;
      motion.centerY.value = centerY - rootOrigin.value.y;

      return cellUnderPiece(centerX, centerY, pieceSize, {
        originX: boardOrigin.value.x,
        originY: boardOrigin.value.y,
        stride,
      });
    };

    /** Where the piece rests in its slot, in drag-layer coordinates. */
    const home = () => {
      'worklet';
      const slot = slotCenters.value[slotIndex];
      return {
        x: (slot?.x ?? 0) - rootOrigin.value.x,
        y: (slot?.y ?? 0) - rootOrigin.value.y,
      };
    };

    return Gesture.Pan()
      .enabled(enabled)
      .minDistance(0)
      .onBegin(() => {
        'worklet';
        lastRow.value = -999;
        lastCol.value = -999;
        lastValid.value = -1;

        motion.session.value += 1;
        dragId.value = motion.session.value;
        motion.active.value = 1;
        motion.wobble.value = 0;
        motion.scale.value = trayScale;
        track(0, 0);
        motion.scale.value = withSpring(1, { damping: 16, stiffness: 320 });
        runOnJS(beginDrag)();
      })
      .onUpdate((event) => {
        'worklet';
        const { row, col } = track(event.translationX, event.translationY);

        // Ignore targets nowhere near the board.
        if (isOffBoard(row, col, rows, columns)) {
          if (lastValid.value !== -1) {
            lastValid.value = -1;
            lastRow.value = -999;
            lastCol.value = -999;
            runOnJS(setPreview)(null);
          }
          return;
        }

        const valid = canPlaceOnGrid(occupancy.value, rows, columns, shape, row, col) ? 1 : 0;
        if (row !== lastRow.value || col !== lastCol.value || valid !== lastValid.value) {
          lastRow.value = row;
          lastCol.value = col;
          lastValid.value = valid;
          runOnJS(setPreview)({ row, col, valid: valid === 1 });
        }
      })
      /**
       * `onFinalize` fires on END *and* on FAILED/CANCELLED, so the success flag
       * is the only thing that distinguishes a deliberate release from the
       * system taking the touch away — an incoming call, a notification pulled
       * down, another recogniser winning. Without it, a drag that happened to be
       * hovering a valid cell when it was cancelled spent the player's turn.
       */
      .onFinalize((_event, success) => {
        'worklet';
        const placed = success && lastValid.value === 1;
        const wasOverBoard = success && lastRow.value !== -999;
        const row = lastRow.value;
        const col = lastCol.value;

        if (placed) {
          // The board takes over rendering this piece immediately.
          motion.active.value = 0;
          runOnJS(endDrag)();
          runOnJS(commit)(row, col);
          return;
        }

        if (wasOverBoard) {
          motion.wobble.value = withSequence(
            withTiming(1, { duration: 55 }),
            withTiming(-1, { duration: 55 }),
            withTiming(0.55, { duration: 55 }),
            withTiming(0, { duration: 55 }),
          );
          runOnJS(onInvalidDrop)();
        }

        // Fly home, then hand rendering back to the tray slot.
        const rest = home();
        motion.scale.value = withSpring(trayScale, { damping: 18, stiffness: 300 });
        motion.centerX.value = withSpring(rest.x, { damping: 20, stiffness: 240 });
        motion.centerY.value = withSpring(rest.y, { damping: 20, stiffness: 240 }, (finished) => {
          'worklet';
          // Hand the piece back to the tray only if this flight actually landed
          // and still owns the layer. A cancelled flight means a live drag took
          // over, and releasing here would hide the piece under the finger.
          if (!shouldReleaseDragLayer(finished === true, motion.session.value, dragId.value)) {
            return;
          }
          motion.active.value = 0;
          runOnJS(endDrag)();
        });
      });
  }, [
    beginDrag,
    boardOrigin,
    columns,
    commit,
    dragId,
    enabled,
    endDrag,
    fullHeight,
    fullWidth,
    lastCol,
    lastRow,
    lastValid,
    liftAmount,
    motion,
    occupancy,
    onInvalidDrop,
    rootOrigin,
    rows,
    setPreview,
    shape,
    slotCenters,
    slotIndex,
    stride,
    trayScale,
  ]);

  return (
    <GestureDetector gesture={pan}>
      <View
        collapsable={false}
        style={{
          width: slotSize,
          height: slotSize,
          alignItems: 'center',
          justifyContent: 'center',
        }}
        accessible
        accessibilityRole="image"
        accessibilityLabel={`${piece.cells.length} block piece${
          dead ? ', no space left on the board' : ''
        }`}
        accessibilityHint="Drag onto the board to place"
      >
        <View
          style={[
            {
              transform: [{ scale: trayScale }],
              // Hidden — not unmounted — while the drag layer owns this piece.
              opacity: isAirborne ? 0 : dead ? 0.32 : 1,
            },
            ELEVATION.tile,
          ]}
        >
          <PieceShape piece={piece} cellSize={cellSize} gap={gap} blocks={theme.blocks} />
        </View>
      </View>
    </GestureDetector>
  );
}
