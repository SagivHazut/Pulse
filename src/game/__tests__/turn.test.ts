import { COMBO_CONFIG, PULSE_METER } from '../../constants/config';
import { resolveTurn, type TurnInput } from '../engine/turn';
import { makeBoard, makePiece } from './helpers';

function baseInput(over: Partial<TurnInput>): TurnInput {
  return {
    board: makeBoard(['....', '....', '....', '....']),
    piece: makePiece(['#']),
    row: 0,
    col: 0,
    combo: 0,
    turnsSinceClear: 0,
    freezeCharges: 0,
    pulseMeter: 0,
    ...over,
  };
}

describe('resolveTurn combo handling', () => {
  it('starts a combo at 1 on the first clear', () => {
    const result = resolveTurn(
      baseInput({ board: makeBoard(['###.', '....', '....', '....']), col: 3 }),
    );
    expect(result.linesCleared).toBe(1);
    expect(result.combo).toBe(1);
    expect(result.turnsSinceClear).toBe(0);
  });

  it('increments the combo on consecutive clears', () => {
    const result = resolveTurn(
      baseInput({ board: makeBoard(['###.', '....', '....', '....']), col: 3, combo: 4 }),
    );
    expect(result.combo).toBe(5);
  });

  it('keeps the combo alive during the grace window', () => {
    const result = resolveTurn(baseInput({ combo: 3, turnsSinceClear: 0 }));
    expect(result.linesCleared).toBe(0);
    expect(result.combo).toBe(3);
    expect(result.turnsSinceClear).toBe(1);
  });

  it('drops the combo once the grace window is exceeded', () => {
    const result = resolveTurn(
      baseInput({ combo: 3, turnsSinceClear: COMBO_CONFIG.graceTurns }),
    );
    expect(result.combo).toBe(0);
  });

  it('spends a freeze charge instead of dropping the combo', () => {
    const result = resolveTurn(
      baseInput({ combo: 3, turnsSinceClear: COMBO_CONFIG.graceTurns, freezeCharges: 1 }),
    );
    expect(result.combo).toBe(3);
    expect(result.freezeCharges).toBe(0);
    expect(result.turnsSinceClear).toBe(0);
  });
});

describe('resolveTurn power tiles', () => {
  it('banks a freeze charge when a freeze tile is cleared', () => {
    const result = resolveTurn(
      baseInput({
        board: makeBoard(['###.', '....', '....', '....']),
        piece: makePiece(['F']),
        col: 3,
      }),
    );
    expect(result.freezeCharges).toBe(1);
  });

  it('fills the Pulse meter when a pulse tile is cleared', () => {
    const result = resolveTurn(
      baseInput({
        board: makeBoard(['###.', '....', '....', '....']),
        piece: makePiece(['P']),
        col: 3,
      }),
    );
    expect(result.pulseFull).toBe(true);
    expect(result.pulseMeter).toBe(0);
  });
});

describe('resolveTurn Pulse meter', () => {
  it('charges on clears and decays on idle turns', () => {
    const cleared = resolveTurn(
      baseInput({ board: makeBoard(['###.', '....', '....', '....']), col: 3 }),
    );
    expect(cleared.pulseMeter).toBeCloseTo(PULSE_METER.gainPerLine);

    const idle = resolveTurn(baseInput({ pulseMeter: 0.5 }));
    expect(idle.pulseMeter).toBeCloseTo(0.5 - PULSE_METER.decayPerIdleTurn);
  });

  it('never goes below zero', () => {
    const idle = resolveTurn(baseInput({ pulseMeter: 0 }));
    expect(idle.pulseMeter).toBe(0);
  });
});

describe('resolveTurn scoring integration', () => {
  it('scores placement plus lines plus combo in one pass', () => {
    // Row 3 completes; a block parked on row 0 keeps this from being a perfect clear.
    const result = resolveTurn(
      baseInput({
        board: makeBoard(['#...', '....', '....', '###.']),
        row: 3,
        col: 3,
        combo: 2,
      }),
    );
    expect(result.score.placement).toBe(10);
    expect(result.score.lines).toBe(100);
    expect(result.score.combo).toBeGreaterThan(0);
    expect(result.score.perfectClear).toBe(0);
    expect(result.score.total).toBe(
      result.score.placement + result.score.lines + result.score.combo,
    );
  });

  it('awards the perfect-clear bonus when the board empties', () => {
    const result = resolveTurn(
      baseInput({ board: makeBoard(['###.', '....', '....', '....']), col: 3 }),
    );
    expect(result.perfectClear).toBe(true);
    expect(result.score.perfectClear).toBeGreaterThan(0);
  });
});
