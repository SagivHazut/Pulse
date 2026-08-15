import {
  GAME_CONFIG,
  GENERATION_CONFIG,
  POWER_BLOCK_CONFIG,
} from '../../constants/config';
import type { Board, BlockColorId, Piece, PieceCell, PowerType } from '../../types';
import { defaultRng, pickWeighted, randomInt, type Rng } from '../../utils/rng';
import { occupancy } from '../engine/board';
import { hasValidPlacement } from '../engine/placement';
import { SHAPES, type ShapeDef } from '../pieces/shapes';

export const BLOCK_COLOR_IDS: readonly BlockColorId[] = [
  'aqua',
  'violet',
  'coral',
  'lime',
  'amber',
  'rose',
  'sky',
];

const POWER_TYPES = Object.keys(POWER_BLOCK_CONFIG.weights) as PowerType[];
const POWER_WEIGHTS = POWER_TYPES.map((t) => POWER_BLOCK_CONFIG.weights[t]);

let pieceCounter = 0;

function nextPieceId(): string {
  pieceCounter += 1;
  return `p${pieceCounter}`;
}

/** Test hook so ids are stable across runs. */
export function resetPieceIds(): void {
  pieceCounter = 0;
}

export type GenerateOptions = {
  rng?: Rng;
  /** Hands dealt so far this run. Drives the difficulty ramp. */
  round?: number;
  handSize?: number;
  /** Set false to suppress power tiles (cooldown between power pieces). */
  allowPower?: boolean;
};

function difficultyWeights(board: Board, round: number): number[] {
  const ramp = Math.min(1, round / GENERATION_CONFIG.difficultyRampRounds);
  const largeBoost = 1 + ramp * (GENERATION_CONFIG.maxLargeShapeBoost - 1);

  return SHAPES.map((shape) => {
    let weight = shape.weight;
    if (shape.cells.length >= 4) weight *= largeBoost;
    // Shapes that cannot fit anywhere become rare, but never impossible — the
    // board is allowed to become genuinely hard.
    if (!shapeFitsAnywhere(board, shape)) weight *= 0.15;
    return Math.max(weight, 0.01);
  });
}

const fitCache = new WeakMap<Board, Map<string, boolean>>();

function shapeFitsAnywhere(board: Board, shape: ShapeDef): boolean {
  let cache = fitCache.get(board);
  if (!cache) {
    cache = new Map();
    fitCache.set(board, cache);
  }
  const cached = cache.get(shape.id);
  if (cached !== undefined) return cached;
  const probe = shapeToPiece(shape, 'aqua', null);
  const fits = hasValidPlacement(board, probe);
  cache.set(shape.id, fits);
  return fits;
}

function shapeToPiece(
  shape: ShapeDef,
  colorId: BlockColorId,
  powerAt: { index: number; type: PowerType } | null,
): Piece {
  const cells: PieceCell[] = shape.cells.map((cell, index) => ({
    r: cell.r,
    c: cell.c,
    power: powerAt && powerAt.index === index ? powerAt.type : null,
  }));
  return {
    id: nextPieceId(),
    shapeId: shape.id,
    cells,
    width: shape.width,
    height: shape.height,
    colorId,
  };
}

function buildHand(board: Board, opts: Required<GenerateOptions>): Piece[] {
  const { rng, round, handSize, allowPower } = opts;
  const weights = difficultyWeights(board, round);

  let powerBudget = allowPower ? POWER_BLOCK_CONFIG.maxPerHand : 0;
  const hand: Piece[] = [];

  for (let i = 0; i < handSize; i += 1) {
    const shape = pickWeighted(rng, SHAPES, weights);
    const colorId = BLOCK_COLOR_IDS[randomInt(rng, 0, BLOCK_COLOR_IDS.length - 1)];

    let powerAt: { index: number; type: PowerType } | null = null;
    if (powerBudget > 0 && rng() < POWER_BLOCK_CONFIG.chancePerPiece) {
      powerBudget -= 1;
      powerAt = {
        index: randomInt(rng, 0, shape.cells.length - 1),
        type: pickWeighted(rng, POWER_TYPES, POWER_WEIGHTS),
      };
    }

    hand.push(shapeToPiece(shape, colorId, powerAt));
  }

  return hand;
}

/**
 * Deal a new hand.
 *
 * Fairness rule: while the board still has room, at least one piece of the hand
 * is guaranteed to fit somewhere. Past `fairnessOccupancyCeiling` that guarantee
 * is dropped — the generator never *forces* a loss, it just stops rescuing you.
 */
export function generatePieces(board: Board, options: GenerateOptions = {}): Piece[] {
  const opts: Required<GenerateOptions> = {
    rng: options.rng ?? defaultRng,
    round: options.round ?? 0,
    handSize: options.handSize ?? GAME_CONFIG.handSize,
    allowPower: options.allowPower ?? true,
  };

  const enforceFairness = occupancy(board) < GENERATION_CONFIG.fairnessOccupancyCeiling;
  if (!enforceFairness) return buildHand(board, opts);

  let fallback: Piece[] | null = null;
  for (let attempt = 0; attempt < GENERATION_CONFIG.fairnessAttempts; attempt += 1) {
    const hand = buildHand(board, opts);
    if (hand.some((piece) => hasValidPlacement(board, piece))) return hand;
    fallback = hand;
  }
  return fallback ?? buildHand(board, opts);
}

/** True when the hand contains at least one power tile. */
export function handHasPower(hand: readonly Piece[]): boolean {
  return hand.some((piece) => piece.cells.some((cell) => cell.power !== null));
}
