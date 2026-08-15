import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

import { GAME_CONFIG } from '../../constants/config';
import { hasValidPlacement } from '../../game/engine/placement';
import type { Board, TraySlot } from '../../types';
import type { BoardMetrics } from '../../utils/layout';
import { DraggablePiece } from './DraggablePiece';

type Props = {
  tray: readonly TraySlot[];
  board: Board;
  metrics: BoardMetrics;
};

const SLOT_INDICES = Array.from({ length: GAME_CONFIG.handSize }, (_, i) => i);
/** measureInWindow can return zeros while layout settles; retry a few times. */
const MEASURE_RETRIES = 6;
const MEASURE_RETRY_MS = 50;

/**
 * The three-slot hand.
 *
 * Slot geometry is measured here, once, from the tray container — not inside the
 * pieces. Two bugs drove that design:
 *
 *  1. Measuring inside a piece meant every freshly dealt hand started with an
 *     unmeasured origin and was undraggable until `measureInWindow` returned.
 *     Pieces are replaced every hand; the tray is not.
 *  2. `measureInWindow` can legitimately return zeros while layout settles, and
 *     a single silent failure left the whole tray unable to place anything. So
 *     one measurement of the container is derived into all three slot centres,
 *     and it retries until it gets a real answer.
 *
 * Pieces with nowhere to go are dimmed, so the player can see the squeeze coming
 * without testing every piece by hand.
 */
export function PieceTray({ tray, board, metrics }: Props) {
  const deadFlags = useMemo(
    () => tray.map((slot) => (slot ? !hasValidPlacement(board, slot) : false)),
    [tray, board],
  );

  const wrapRef = useRef<View>(null);
  const retries = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slotCenters = useSharedValue<{ x: number; y: number }[]>(
    SLOT_INDICES.map(() => ({ x: 0, y: 0 })),
  );

  const measure = useCallback(() => {
    wrapRef.current?.measureInWindow((x, y, width, height) => {
      if (width === 0 || height === 0) {
        // Not laid out yet. Keep asking — a slot stuck at (0,0) cannot be
        // dragged onto the board at all, so giving up here breaks the game.
        if (retries.current < MEASURE_RETRIES) {
          retries.current += 1;
          timer.current = setTimeout(measure, MEASURE_RETRY_MS);
        }
        return;
      }
      retries.current = 0;
      const slotWidth = width / SLOT_INDICES.length;
      slotCenters.value = SLOT_INDICES.map((index) => ({
        x: x + slotWidth * (index + 0.5),
        y: y + height / 2,
      }));
    });
  }, [slotCenters]);

  const scheduleMeasure = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    retries.current = 0;
    timer.current = setTimeout(measure, 0);
  }, [measure]);

  /**
   * Re-measure on anything that could move the tray: mount, rotation, resize —
   * and on a new hand, which is free insurance against a missed first layout.
   */
  useEffect(() => {
    scheduleMeasure();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [scheduleMeasure, metrics.traySlotSize, metrics.screenWidth, metrics.screenHeight, tray]);

  return (
    <View
      ref={wrapRef}
      onLayout={scheduleMeasure}
      collapsable={false}
      style={[styles.wrap, { height: metrics.traySlotSize }]}
    >
      {SLOT_INDICES.map((index) => {
        const slot = tray[index] ?? null;
        return (
          <View key={index} style={styles.slot}>
            {slot ? (
              <DraggablePiece
                key={slot.id}
                piece={slot}
                slotIndex={index}
                slotCenters={slotCenters}
                slotSize={metrics.traySlotSize}
                dead={deadFlags[index] ?? false}
              />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  slot: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
