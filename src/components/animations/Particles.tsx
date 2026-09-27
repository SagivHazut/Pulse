import React, { memo, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

/**
 * Particle bursts, drawn from a fixed pool.
 *
 * The previous version mounted a fresh Animated.View — with its own shared value,
 * effect and animated style — for every particle, at the instant a line cleared.
 * Up to 44 of them, in the same frame as the clear's own re-render, which is
 * exactly when the game already had the most work to do. That mount storm is what
 * made combos stutter on device.
 *
 * Now {@link POOL_SIZE} particles are mounted once with the screen and stay
 * mounted. A burst writes one array of specs and restarts one progress value;
 * every particle reads its own slot on the UI thread. A clear costs two shared
 * value writes and no React work at all.
 */

type Spec = {
  x: number;
  y: number;
  color: string;
  size: number;
  /** Final offset from the origin, precomputed so the worklet only scales it. */
  dx: number;
  dy: number;
  /** 0–1 share of the burst's duration this particle lives for. */
  life: number;
};

const POOL_SIZE = 36;
/** Every dot is drawn at this size and scaled to its own. */
const BASE_SIZE = 10;
const BURST_MS = 700;

const IDLE: Spec = { x: -100, y: -100, color: 'transparent', size: 0, dx: 0, dy: 0, life: 1 };

const Particle = memo(function Particle({
  index,
  specs,
  progress,
}: {
  index: number;
  specs: SharedValue<Spec[]>;
  progress: SharedValue<number>;
}) {
  // Only transform, opacity and colour change per frame. Those are the props
  // Reanimated can write straight to the screen; `left`/`top`/`width` force a
  // layout pass every frame instead. The dot is a fixed-size circle at the
  // origin, moved and sized purely by its transform.
  const style = useAnimatedStyle(() => {
    const spec = specs.value[index] ?? IDLE;
    const p = Math.min(1, progress.value / spec.life);
    return {
      backgroundColor: spec.color,
      opacity: spec.size === 0 ? 0 : 1 - p * p,
      transform: [
        { translateX: spec.x - BASE_SIZE / 2 + spec.dx * p },
        // A little gravity keeps the burst from looking like a starburst decal.
        { translateY: spec.y - BASE_SIZE / 2 + spec.dy * p + 46 * p * p },
        { scale: (spec.size / BASE_SIZE) * (1 - 0.45 * p) },
      ],
    };
  });

  return <Animated.View pointerEvents="none" style={[styles.particle, style]} />;
});

type Props = {
  /** Increment to trigger; the field reads `points` when this changes. */
  nonce: number;
  points: { x: number; y: number }[];
  colors: string[];
  intensity?: number;
  enabled?: boolean;
};

export function ParticleField({ nonce, points, colors, intensity = 1, enabled = true }: Props) {
  const specs = useSharedValue<Spec[]>([]);
  const progress = useSharedValue(1);
  const lastNonce = useRef(0);

  useEffect(() => {
    if (!enabled || nonce === lastNonce.current || points.length === 0) return;
    lastNonce.current = nonce;

    const perPoint = Math.max(1, Math.round(3 * intensity));
    const wanted = points.length * perPoint;
    const count = Math.min(POOL_SIZE, wanted);
    const step = wanted / count;

    const next: Spec[] = [];
    for (let i = 0; i < count; i += 1) {
      const point = points[Math.floor(i * step) % points.length];
      const angle = Math.random() * Math.PI * 2;
      const distance = (26 + Math.random() * 48) * intensity;
      next.push({
        x: point.x,
        y: point.y,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 4 + Math.random() * 5 * intensity,
        dx: Math.cos(angle) * distance,
        dy: Math.sin(angle) * distance,
        life: 0.6 + Math.random() * 0.4,
      });
    }

    specs.value = next;
    progress.value = 0;
    progress.value = withTiming(1, { duration: BURST_MS, easing: Easing.out(Easing.quad) });
  }, [nonce, points, colors, intensity, enabled, specs, progress]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: POOL_SIZE }, (_, index) => (
        <Particle key={index} index={index} specs={specs} progress={progress} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  particle: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: BASE_SIZE,
    height: BASE_SIZE,
    borderRadius: BASE_SIZE / 2,
  },
});
