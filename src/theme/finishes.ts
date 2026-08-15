/**
 * Block finishes: a second cosmetic axis, independent of the theme.
 *
 * A theme decides *what colour* the blocks are; a finish decides *how they are
 * built* — the lip, the highlight, the corner radius, whether the tile is solid
 * at all. That means 8 themes × 4 finishes read as 32 distinct boards without
 * authoring 32 palettes, and it gives coins somewhere to go once the theme
 * ladder is done.
 *
 * Purely visual. Nothing here touches gameplay.
 */
export type BlockFinishId = 'gloss' | 'flat' | 'bevel' | 'outline';

export type BlockFinish = {
  id: BlockFinishId;
  name: string;
  tagline: string;
  price: number;
  unlockLevel: number;
  /** Bottom lip thickness as a fraction of tile size. 0 for no lip. */
  lipRatio: number;
  /** Opacity of the top highlight. 0 removes it. */
  highlightOpacity: number;
  /** Highlight height as a fraction of the tile body. */
  highlightHeightRatio: number;
  /** Hairline border on the tile body. */
  bodyBorderWidth: number;
  /** Corner radius as a fraction of tile size. */
  radiusRatio: number;
  /** Hollow tiles are drawn as a thick coloured ring over a faint fill. */
  hollow: boolean;
};

const GLOSS: BlockFinish = {
  id: 'gloss',
  name: 'Gloss',
  tagline: 'Soft depth, glassy top',
  price: 0,
  unlockLevel: 1,
  lipRatio: 0.09,
  highlightOpacity: 0.5,
  highlightHeightRatio: 0.34,
  bodyBorderWidth: 1,
  radiusRatio: 0.22,
  hollow: false,
};

const FLAT: BlockFinish = {
  id: 'flat',
  name: 'Flat',
  tagline: 'Pure colour, no gloss',
  price: 600,
  unlockLevel: 5,
  lipRatio: 0,
  highlightOpacity: 0,
  highlightHeightRatio: 0,
  bodyBorderWidth: 0,
  radiusRatio: 0.24,
  hollow: false,
};

const BEVEL: BlockFinish = {
  id: 'bevel',
  name: 'Bevel',
  tagline: 'Chunky, moulded, arcade',
  price: 1000,
  unlockLevel: 9,
  lipRatio: 0.17,
  highlightOpacity: 0.72,
  highlightHeightRatio: 0.42,
  bodyBorderWidth: 1.5,
  radiusRatio: 0.13,
  hollow: false,
};

const OUTLINE: BlockFinish = {
  id: 'outline',
  name: 'Outline',
  tagline: 'Hollow rings, minimal ink',
  price: 1600,
  unlockLevel: 13,
  lipRatio: 0,
  highlightOpacity: 0,
  highlightHeightRatio: 0,
  bodyBorderWidth: 3,
  radiusRatio: 0.26,
  hollow: true,
};

/** Registry, cheapest first. Adding a finish needs no other change. */
export const BLOCK_FINISHES: readonly BlockFinish[] = [GLOSS, FLAT, BEVEL, OUTLINE];

export const DEFAULT_FINISH_ID: BlockFinishId = GLOSS.id;

export function getFinish(id: string): BlockFinish {
  return BLOCK_FINISHES.find((f) => f.id === id) ?? GLOSS;
}
