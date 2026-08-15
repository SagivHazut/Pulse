import React, { memo, useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

/**
 * Lightweight particle bursts.
 *
 * Deliberately not a physics engine: each particle is one Animated.View driving
 * a single 0→1 shared value, and the total count is capped so a ten-line cascade
 * costs the same as a single clear. Bursts unmount themselves when finished.
 */

export type ParticleSpec = {
  x: number;
  y: number;
  color: string;
  size: number;
  angle: number;
  distance: number;
  duration: number;
};

const MAX_PARTICLES = 44;

const Particle = memo(function Particle({ spec }: { spec: ParticleSpec }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, {
      duration: spec.duration,
      easing: Easing.out(Easing.quad),
    });
  }, [progress, spec.duration]);

  const style = useAnimatedStyle(() => {
    const p = progress.value;
    const dx = Math.cos(spec.angle) * spec.distance * p;
    // A little gravity keeps the burst from looking like a starburst decal.
    const dy = Math.sin(spec.angle) * spec.distance * p + 46 * p * p;
    return {
      opacity: 1 - p * p,
      transform: [{ translateX: dx }, { translateY: dy }, { scale: 1 - 0.45 * p }],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: spec.x - spec.size / 2,
          top: spec.y - spec.size / 2,
          width: spec.size,
          height: spec.size,
          borderRadius: spec.size / 2,
          backgroundColor: spec.color,
        },
        style,
      ]}
    />
  );
});

type Burst = { id: number; specs: ParticleSpec[] };

export type ParticleFieldHandle = {
  burst(points: { x: number; y: number }[], colors: string[], intensity?: number): void;
};

type Props = {
  /** Increment to trigger; the field reads `points` when this changes. */
  nonce: number;
  points: { x: number; y: number }[];
  colors: string[];
  intensity?: number;
  enabled?: boolean;
};

export function ParticleField({ nonce, points, colors, intensity = 1, enabled = true }: Props) {
  const [bursts, setBursts] = useState<Burst[]>([]);
  const lastNonce = useRef(0);

  useEffect(() => {
    if (!enabled || nonce === lastNonce.current || points.length === 0) return;
    lastNonce.current = nonce;

    const perPoint = Math.max(1, Math.round(3 * intensity));
    const budget = Math.min(MAX_PARTICLES, points.length * perPoint);
    const step = Math.max(1, Math.floor((points.length * perPoint) / budget));

    const specs: ParticleSpec[] = [];
    for (let i = 0; i < points.length * perPoint; i += step) {
      const point = points[i % points.length];
      const angle = Math.random() * Math.PI * 2;
      specs.push({
        x: point.x,
        y: point.y,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 4 + Math.random() * 5 * intensity,
        angle,
        distance: (26 + Math.random() * 48) * intensity,
        duration: 420 + Math.random() * 260,
      });
      if (specs.length >= budget) break;
    }

    const burst: Burst = { id: nonce, specs };
    setBursts((prev) => [...prev.slice(-2), burst]);

    const timer = setTimeout(() => {
      setBursts((prev) => prev.filter((b) => b.id !== burst.id));
    }, 760);
    return () => clearTimeout(timer);
  }, [nonce, points, colors, intensity, enabled]);

  if (bursts.length === 0) return null;

  return (
    <Animated.View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {bursts.map((burst) =>
        burst.specs.map((spec, index) => (
          <Particle key={`${burst.id}-${index}`} spec={spec} />
        )),
      )}
    </Animated.View>
  );
}
