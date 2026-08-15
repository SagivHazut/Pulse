import { createRng } from '../../utils/rng';
import { createEmptyBoard } from '../engine/board';
import { generatePieces, handHasPower } from '../generators/pieceGenerator';
import { DEFAULT_MODE, getMode, isGameMode, MODES, MODE_ORDER } from '../modes';

describe('mode registry', () => {
  it('describes both modes in display order', () => {
    expect(MODE_ORDER).toEqual(['classic', 'pulse']);
    for (const id of MODE_ORDER) {
      expect(MODES[id].id).toBe(id);
      expect(MODES[id].name.length).toBeGreaterThan(0);
      expect(MODES[id].tagline.length).toBeGreaterThan(0);
    }
  });

  it('turns every power system off in Classic and on in Pulse', () => {
    expect(MODES.classic).toMatchObject({
      powerTiles: false,
      powerUps: false,
      pulseMeter: false,
    });
    expect(MODES.pulse).toMatchObject({
      powerTiles: true,
      powerUps: true,
      pulseMeter: true,
    });
  });

  it('falls back to Pulse for anything unrecognised', () => {
    expect(getMode('classic').id).toBe('classic');
    expect(getMode('pulse').id).toBe('pulse');
    expect(getMode('nonsense').id).toBe('pulse');
    expect(getMode(null).id).toBe('pulse');
    expect(getMode(undefined).id).toBe(DEFAULT_MODE);
  });

  it('recognises only real mode ids', () => {
    expect(isGameMode('classic')).toBe(true);
    expect(isGameMode('pulse')).toBe(true);
    expect(isGameMode('Classic')).toBe(false);
    expect(isGameMode(null)).toBe(false);
    expect(isGameMode(2)).toBe(false);
  });
});

/**
 * The promise Classic makes is "no powers at all". Since the generator is what
 * would break it, prove it across a wide sweep of seeds and board states rather
 * than trusting the flag.
 */
describe('Classic deals no power tiles', () => {
  it('never produces a power tile, at any seed', () => {
    for (let seed = 0; seed < 300; seed += 1) {
      const hand = generatePieces(createEmptyBoard(), {
        rng: createRng(seed),
        allowPower: MODES.classic.powerTiles,
      });
      expect(handHasPower(hand)).toBe(false);
    }
  });

  it('never produces a power tile late in a run either', () => {
    for (let round = 0; round < 60; round += 10) {
      for (let seed = 0; seed < 40; seed += 1) {
        const hand = generatePieces(createEmptyBoard(), {
          rng: createRng(seed),
          round,
          allowPower: MODES.classic.powerTiles,
        });
        expect(handHasPower(hand)).toBe(false);
      }
    }
  });

  it('still deals a full, placeable hand', () => {
    const hand = generatePieces(createEmptyBoard(), {
      rng: createRng(11),
      allowPower: MODES.classic.powerTiles,
    });
    expect(hand).toHaveLength(3);
    for (const piece of hand) expect(piece.cells.length).toBeGreaterThan(0);
  });

  /** Pulse must still actually deliver powers, or the modes are identical. */
  it('Pulse does produce power tiles across a sweep', () => {
    let withPower = 0;
    for (let seed = 0; seed < 300; seed += 1) {
      const hand = generatePieces(createEmptyBoard(), {
        rng: createRng(seed),
        allowPower: MODES.pulse.powerTiles,
      });
      if (handHasPower(hand)) withPower += 1;
    }
    expect(withPower).toBeGreaterThan(0);
  });
});
