import { create } from 'zustand';

import type { Piece } from '../types';

export type PreviewState = {
  row: number;
  col: number;
  valid: boolean;
};

type DragState = {
  /**
   * Snapped target cell. Updated only when the target *changes*, never per
   * frame — the piece itself follows the finger entirely on the UI thread.
   */
  preview: PreviewState | null;
  /** The piece currently in the air, if any. */
  draggingPiece: Piece | null;
};

/**
 * The in-flight drag, kept out of GameScreen's state on purpose.
 *
 * It used to live there, and every change to the hovered cell re-rendered the
 * entire screen: measured on one drag across the board, 18 cell crossings meant
 * 18 renders each of GameScreen, ScoreHud, PulseMeter, PieceTray, PowerUpBar and
 * all three tray pieces — none of which draw anything that depends on it. Only
 * the board (the ghost and the line highlight) and the drag layer do, so only
 * they subscribe.
 */
export const useDragStore = create<DragState>(() => ({
  preview: null,
  draggingPiece: null,
}));

/**
 * Plain module functions rather than store methods, so their identity never
 * changes. The drag gesture captures them in worklets and hands them to
 * `runOnJS`; an identity that shifted between renders would rebuild the gesture.
 */
export function setDragPreview(preview: PreviewState | null): void {
  const current = useDragStore.getState().preview;
  if (
    current === preview ||
    (current !== null &&
      preview !== null &&
      current.row === preview.row &&
      current.col === preview.col &&
      current.valid === preview.valid)
  ) {
    return;
  }
  useDragStore.setState({ preview });
}

export function setDraggingPiece(piece: Piece | null): void {
  useDragStore.setState({ draggingPiece: piece });
}

/**
 * Drop the drag layer only if `pieceId` still owns it. A fly-home animation that
 * lands late must not cancel a newer drag that has already taken over.
 */
export function releaseDraggingPiece(pieceId: string): void {
  if (useDragStore.getState().draggingPiece?.id === pieceId) {
    useDragStore.setState({ draggingPiece: null });
  }
}

export function resetDrag(): void {
  useDragStore.setState({ preview: null, draggingPiece: null });
}
