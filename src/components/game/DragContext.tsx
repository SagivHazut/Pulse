import React, { createContext, useContext } from 'react';
import type { SharedValue } from 'react-native-reanimated';

import type { BoardMetrics } from '../../utils/layout';

export type { PreviewState } from '../../stores/useDragStore';

/**
 * Shared values that describe the piece currently in the air. They are written
 * by the gesture worklet and read by the root-level drag layer, so the dragged
 * piece is never clipped by the tray and always paints above the board.
 */
export type DragMotion = {
  /** Centre of the dragged piece, in coordinates local to the screen root. */
  centerX: SharedValue<number>;
  centerY: SharedValue<number>;
  scale: SharedValue<number>;
  /** -1..1 shake used to reject an invalid drop. */
  wobble: SharedValue<number>;
  active: SharedValue<number>;
  /**
   * Incremented on every pickup. A drag's own animations check it before
   * cleaning up, so a stale callback cannot cancel a newer drag.
   */
  session: SharedValue<number>;
};

export type DragContextValue = {
  metrics: BoardMetrics;
  rows: number;
  columns: number;
  /** Window coordinates of the top-left corner of cell (0,0). */
  boardOrigin: SharedValue<{ x: number; y: number }>;
  /** Window coordinates of the screen root, for converting to layer space. */
  rootOrigin: SharedValue<{ x: number; y: number }>;
  /** Flat 0/1 board mirror the drag worklet validates against. */
  occupancy: SharedValue<number[]>;
  motion: DragMotion;

  onDrop: (pieceId: string, row: number, col: number) => void;
  onInvalidDrop: () => void;
  enabled: boolean;
};

const DragContext = createContext<DragContextValue | null>(null);

export function DragProvider({
  value,
  children,
}: {
  value: DragContextValue;
  children: React.ReactNode;
}) {
  return <DragContext.Provider value={value}>{children}</DragContext.Provider>;
}

export function useDragContext(): DragContextValue {
  const ctx = useContext(DragContext);
  if (!ctx) throw new Error('useDragContext must be used inside a DragProvider');
  return ctx;
}
