import React from 'react';
import { StyleSheet, View } from 'react-native';

type Props = {
  color: string;
  /** Side of the square the arrow is drawn into. */
  size?: number;
  thickness?: number;
};

/**
 * A left arrow, drawn rather than typed.
 *
 * This used to be U+2190 in a `<Text>`, which meant its shape came from whatever
 * the platform font felt like. Measured inside the same 42dp button, SF drew it
 * 10.0dp tall and centred; Roboto drew it **4.2dp** tall and sitting 3.2dp below
 * centre. Android's back button read as a faint dash low in an empty box, and no
 * amount of `includeFontPadding` or `lineHeight` tuning fixes it — those move the
 * line box, not the outline the font puts inside it.
 *
 * The gear (U+2699) measured 14.5dp and centred on Android, so this is not a
 * problem with glyph icons in general and the rest of {@link GLYPH} is left
 * alone. It is a problem with this one character.
 *
 * Three rectangles: a shaft, and two head strokes meeting at its tip. Geometry
 * instead of typography, so both platforms get the same arrow.
 */
export function BackArrow({ color, size = 15, thickness = 2 }: Props) {
  const head = size * 0.44;
  const mid = size / 2;

  // The head strokes are rounded, so their caps stick out past the tip along the
  // 45-degree axis — on the left only, since that is where they point. Starting
  // the tip one overhang in makes the ink span exactly 0..size; anchoring it at
  // thickness/2 instead left the whole arrow sitting 0.4dp right of centre on
  // both platforms.
  const overhang = (thickness / 2) * Math.SQRT1_2;
  const tipX = overhang;

  // A bar rotates about its own centre, so placing its *left end* on the tip
  // means undoing half its length along the rotated axis. cos45 = sin45 =
  // 0.7071, so the offsets fall out as L/2 - (L/2)(0.7071) and (L/2)(0.7071).
  const inset = (head / 2) * (1 - Math.SQRT1_2);
  const rise = (head / 2) * Math.SQRT1_2;

  const bar = {
    position: 'absolute' as const,
    height: thickness,
    borderRadius: thickness / 2,
    backgroundColor: color,
  };

  return (
    <View style={[styles.box, { width: size, height: size }]}>
      <View style={[bar, { left: tipX, width: size - tipX, top: mid - thickness / 2 }]} />
      <View
        style={[
          bar,
          {
            left: tipX - inset,
            width: head,
            top: mid - thickness / 2 - rise,
            transform: [{ rotate: '-45deg' }],
          },
        ]}
      />
      <View
        style={[
          bar,
          {
            left: tipX - inset,
            width: head,
            top: mid - thickness / 2 + rise,
            transform: [{ rotate: '45deg' }],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
});
