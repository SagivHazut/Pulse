import React, { memo, useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { GAME_CONFIG } from '../../constants/config';
import type { ClearEvent } from '../../stores/useGameStore';

/**
 * What a clear *looks* like, on top of the cells bursting.
 *
 *  - Every cleared row and column gets a beam that flares across it, so a double
 *    or a triple reads as two or three events rather than one bigger deletion.
 *  - A bomb gets a shockwave ring and a hot core at its target.
 *  - A bolt gets a flickering cross of beams through its target.
 *
 * Like the particle pool, all of it is mounted once and driven by a handful of
 * shared values. A clear only writes those values, so the extra spectacle costs
 * no React work in the frame that already has the most of it.
 */

const ROWS = GAME_CONFIG.rows;
const COLUMNS = GAME_CONFIG.columns;

/** Encoded as numbers so worklets can branch on them without string compares. */
const KIND_LINE = 0;
const KIND_BOMB = 1;
const KIND_BOLT = 2;

type Fx = {
  rowsMask: SharedValue<number>;
  colsMask: SharedValue<number>;
  kind: SharedValue<number>;
  targetRow: SharedValue<number>;
  targetCol: SharedValue<number>;
  /** 1 for a single line; grows with lines cleared and combo tier. */
  strength: SharedValue<number>;
  /** 0 → 1 over one effect. */
  progress: SharedValue<number>;
};

type Geometry = { cellSize: number; stride: number; gap: number };

/**
 * One beam across a row or down a column.
 *
 * A line clear flares it out from the centre and lets it fade; a bolt flickers
 * it. Both paint a soft outer glow and a white-hot core.
 */
const Beam = memo(function Beam({
  axis,
  index,
  fx,
  geometry,
  lineColor,
  boltColor,
}: {
  axis: 'row' | 'col';
  index: number;
  fx: Fx;
  geometry: Geometry;
  lineColor: string;
  boltColor: string;
}) {
  const { cellSize, stride, gap } = geometry;
  const span = (axis === 'row' ? COLUMNS : ROWS) * stride - gap;
  const isRow = axis === 'row';
  // Captured one by one: worklets serialise what they close over, and plain
  // shared-value refs are the cheapest thing to hand across.
  const { rowsMask, colsMask, kind, strength, progress } = fx;

  const glow = useAnimatedStyle(() => {
    const mask = isRow ? rowsMask.value : colsMask.value;
    const on = (mask >> index) & 1;
    const p = progress.value;
    const bolt = kind.value === KIND_BOLT;

    // Lines: flare in over the first third, then fade. Bolts: a hard flicker.
    const envelope = bolt
      ? Math.max(0, 1 - p) * (0.55 + 0.45 * Math.abs(Math.sin(p * Math.PI * 7)))
      : p < 0.3
        ? p / 0.3
        : Math.max(0, 1 - (p - 0.3) / 0.7);
    const reach = bolt ? 1 : Math.min(1, p / 0.3);
    const thickness = 1 + 0.35 * strength.value * Math.max(0, 1 - p);

    return {
      opacity: on ? envelope : 0,
      backgroundColor: bolt ? boltColor : lineColor,
      transform: isRow
        ? [{ scaleX: reach }, { scaleY: thickness }]
        : [{ scaleY: reach }, { scaleX: thickness }],
    };
  });

  const core = useAnimatedStyle(() => {
    const mask = isRow ? rowsMask.value : colsMask.value;
    const on = (mask >> index) & 1;
    const p = progress.value;
    const bolt = kind.value === KIND_BOLT;
    const envelope = bolt
      ? Math.max(0, 1 - p * 1.2) * (0.4 + 0.6 * Math.abs(Math.sin(p * Math.PI * 9)))
      : p < 0.25
        ? p / 0.25
        : Math.max(0, 1 - (p - 0.25) / 0.45);
    const reach = bolt ? 1 : Math.min(1, p / 0.25);
    return {
      opacity: on ? envelope : 0,
      transform: isRow ? [{ scaleX: reach }] : [{ scaleY: reach }],
    };
  });

  const coreThickness = Math.max(3, cellSize * 0.16);
  const frame =
    axis === 'row'
      ? { left: 0, top: index * stride, width: span, height: cellSize }
      : { top: 0, left: index * stride, height: span, width: cellSize };
  const coreFrame =
    axis === 'row'
      ? {
          left: 0,
          top: index * stride + (cellSize - coreThickness) / 2,
          width: span,
          height: coreThickness,
        }
      : {
          top: 0,
          left: index * stride + (cellSize - coreThickness) / 2,
          height: span,
          width: coreThickness,
        };

  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[styles.abs, frame, { borderRadius: cellSize * 0.3 }, glow]}
      />
      <Animated.View
        pointerEvents="none"
        style={[styles.abs, coreFrame, styles.core, { borderRadius: coreThickness }, core]}
      />
    </>
  );
});

/** Shockwave ring and hot core for a bomb. */
const Blast = memo(function Blast({
  fx,
  geometry,
  color,
}: {
  fx: Fx;
  geometry: Geometry;
  color: string;
}) {
  const { cellSize, stride } = geometry;
  // Sized to the 3x3 the bomb clears, so the ring lands on the blast radius.
  const size = stride * 3;
  const { kind, progress, targetRow, targetCol } = fx;

  const ring = useAnimatedStyle(() => {
    const on = kind.value === KIND_BOMB;
    const p = progress.value;
    const cx = targetCol.value * stride + cellSize / 2;
    const cy = targetRow.value * stride + cellSize / 2;
    return {
      opacity: on ? Math.max(0, 1 - p) : 0,
      // Placed by translate rather than left/top, so every frame stays on
      // Reanimated's direct path instead of forcing a layout pass.
      transform: [
        { translateX: cx - size / 2 },
        { translateY: cy - size / 2 },
        { scale: 0.25 + p * 1.35 },
      ],
    };
  });

  const coreStyle = useAnimatedStyle(() => {
    const on = kind.value === KIND_BOMB;
    const p = progress.value;
    const cx = targetCol.value * stride + cellSize / 2;
    const cy = targetRow.value * stride + cellSize / 2;
    return {
      opacity: on ? Math.max(0, 0.9 - p * 1.4) : 0,
      transform: [
        { translateX: cx - size / 2 },
        { translateY: cy - size / 2 },
        { scale: 0.2 + Math.min(1, p * 2.5) * 0.75 },
      ],
    };
  });

  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.abs,
          // A near-white flash reads as heat; the theme colour is kept for the ring.
          { width: size, height: size, borderRadius: size / 2, backgroundColor: '#FFF4D6' },
          coreStyle,
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.abs,
          styles.origin,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: Math.max(6, cellSize * 0.22),
            borderColor: color,
          },
          ring,
        ]}
      />
    </>
  );
});

type Props = {
  event: ClearEvent | null;
  cellSize: number;
  stride: number;
  gap: number;
  lineColor: string;
  boltColor: string;
  blastColor: string;
  reducedMotion: boolean;
};

export const ClearFx = memo(function ClearFx({
  event,
  cellSize,
  stride,
  gap,
  lineColor,
  boltColor,
  blastColor,
  reducedMotion,
}: Props) {
  const rowsMask = useSharedValue(0);
  const colsMask = useSharedValue(0);
  const kind = useSharedValue(KIND_LINE);
  const targetRow = useSharedValue(0);
  const targetCol = useSharedValue(0);
  const strength = useSharedValue(1);
  const progress = useSharedValue(1);
  // Stable bags, so the memoised beams are not re-rendered by every GameScreen
  // render — 32 of them would otherwise redo their work on each score change.
  const fx = useMemo<Fx>(
    () => ({ rowsMask, colsMask, kind, targetRow, targetCol, strength, progress }),
    [rowsMask, colsMask, kind, targetRow, targetCol, strength, progress],
  );
  const geometry = useMemo(() => ({ cellSize, stride, gap }), [cellSize, stride, gap]);

  const eventId = event?.id ?? 0;
  useEffect(() => {
    if (!event || reducedMotion) return;

    let rows = 0;
    let cols = 0;
    let effect = KIND_LINE;
    if (event.power?.kind === 'bomb') {
      effect = KIND_BOMB;
    } else if (event.power?.kind === 'lightning') {
      effect = KIND_BOLT;
      rows = 1 << event.power.row;
      cols = 1 << event.power.col;
    } else {
      for (const r of event.lines.rows) rows |= 1 << r;
      for (const c of event.lines.cols) cols |= 1 << c;
    }
    if (effect === KIND_LINE && rows === 0 && cols === 0) return;

    rowsMask.value = rows;
    colsMask.value = cols;
    kind.value = effect;
    targetRow.value = event.power?.row ?? 0;
    targetCol.value = event.power?.col ?? 0;
    // More lines at once, or a hotter combo, means a heavier flare.
    const tierBoost = event.tier === 'dramatic' ? 1.2 : event.tier === 'hype' ? 0.6 : 0;
    strength.value = Math.max(1, event.linesCleared) + tierBoost;

    // Quadratic, not cubic: a cubic ease-out spends most of its change in the
    // first 150ms, and on device the flare read as a flicker rather than a beat.
    const duration = effect === KIND_BOMB ? 620 : effect === KIND_BOLT ? 540 : 560;
    progress.value = withSequence(
      withTiming(0, { duration: 0 }),
      withTiming(1, { duration, easing: Easing.out(Easing.quad) }),
    );
    // Keyed on the event id: the event object is replaced on every store write.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, reducedMotion]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: ROWS }, (_, i) => (
        <Beam
          key={`r${i}`}
          axis="row"
          index={i}
          fx={fx}
          geometry={geometry}
          lineColor={lineColor}
          boltColor={boltColor}
        />
      ))}
      {Array.from({ length: COLUMNS }, (_, i) => (
        <Beam
          key={`c${i}`}
          axis="col"
          index={i}
          fx={fx}
          geometry={geometry}
          lineColor={lineColor}
          boltColor={boltColor}
        />
      ))}
      <Blast fx={fx} geometry={geometry} color={blastColor} />
    </View>
  );
});

const styles = StyleSheet.create({
  abs: { position: 'absolute' },
  origin: { left: 0, top: 0 },
  core: { backgroundColor: '#FFFFFF' },
});
