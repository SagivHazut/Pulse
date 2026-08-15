import type { PieceCell } from '../../types';

export type ShapeDef = {
  id: string;
  /** Occupied offsets, normalized so min row and min col are both 0. */
  cells: readonly { r: number; c: number }[];
  width: number;
  height: number;
  /** Base spawn weight. Large shapes get boosted later in a run. */
  weight: number;
};

type RawShape = { id: string; grid: string[]; weight: number };

/**
 * Shapes are authored as ASCII so they are easy to read and extend.
 * '#' is an occupied tile, '.' is empty.
 */
const RAW_SHAPES: RawShape[] = [
  { id: 'dot', grid: ['#'], weight: 30 },

  { id: 'i2-h', grid: ['##'], weight: 34 },
  { id: 'i2-v', grid: ['#', '#'], weight: 34 },

  { id: 'i3-h', grid: ['###'], weight: 30 },
  { id: 'i3-v', grid: ['#', '#', '#'], weight: 30 },

  { id: 'i4-h', grid: ['####'], weight: 18 },
  { id: 'i4-v', grid: ['#', '#', '#', '#'], weight: 18 },

  { id: 'i5-h', grid: ['#####'], weight: 8 },
  { id: 'i5-v', grid: ['#', '#', '#', '#', '#'], weight: 8 },

  { id: 'o2', grid: ['##', '##'], weight: 26 },
  { id: 'o3', grid: ['###', '###', '###'], weight: 5 },

  { id: 'corner-tl', grid: ['##', '#.'], weight: 22 },
  { id: 'corner-tr', grid: ['##', '.#'], weight: 22 },
  { id: 'corner-bl', grid: ['#.', '##'], weight: 22 },
  { id: 'corner-br', grid: ['.#', '##'], weight: 22 },

  { id: 'l-a', grid: ['#..', '#..', '###'], weight: 12 },
  { id: 'l-b', grid: ['###', '#..', '#..'], weight: 12 },
  { id: 'l-c', grid: ['###', '..#', '..#'], weight: 12 },
  { id: 'l-d', grid: ['..#', '..#', '###'], weight: 12 },

  { id: 'j-a', grid: ['#.', '#.', '##'], weight: 14 },
  { id: 'j-b', grid: ['##', '#.', '#.'], weight: 14 },
  { id: 'j-c', grid: ['##', '.#', '.#'], weight: 14 },
  { id: 'j-d', grid: ['.#', '.#', '##'], weight: 14 },

  { id: 't-up', grid: ['###', '.#.'], weight: 14 },
  { id: 't-down', grid: ['.#.', '###'], weight: 14 },
  { id: 't-left', grid: ['.#', '##', '.#'], weight: 14 },
  { id: 't-right', grid: ['#.', '##', '#.'], weight: 14 },

  { id: 's-h', grid: ['.##', '##.'], weight: 10 },
  { id: 'z-h', grid: ['##.', '.##'], weight: 10 },
  { id: 's-v', grid: ['#.', '##', '.#'], weight: 10 },
  { id: 'z-v', grid: ['.#', '##', '#.'], weight: 10 },

  { id: 'rect-2x3', grid: ['###', '###'], weight: 9 },
  { id: 'rect-3x2', grid: ['##', '##', '##'], weight: 9 },
];

function parse(raw: RawShape): ShapeDef {
  const cells: { r: number; c: number }[] = [];
  raw.grid.forEach((line, r) => {
    line.split('').forEach((ch, c) => {
      if (ch === '#') cells.push({ r, c });
    });
  });
  const height = raw.grid.length;
  const width = Math.max(...raw.grid.map((l) => l.length));
  return { id: raw.id, cells, width, height, weight: raw.weight };
}

export const SHAPES: readonly ShapeDef[] = RAW_SHAPES.map(parse);

export const SHAPES_BY_ID: Readonly<Record<string, ShapeDef>> = SHAPES.reduce(
  (acc, s) => {
    acc[s.id] = s;
    return acc;
  },
  {} as Record<string, ShapeDef>,
);

export function shapeTileCount(shape: ShapeDef): number {
  return shape.cells.length;
}

/** Piece cells for a shape, with no power tiles applied. */
export function toPieceCells(shape: ShapeDef): PieceCell[] {
  return shape.cells.map((c) => ({ r: c.r, c: c.c, power: null }));
}
