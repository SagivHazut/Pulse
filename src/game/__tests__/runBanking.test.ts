import { xpFromRun } from '../progression';
import { bankRun, EMPTY_BANKED_RUN, runDelta } from '../runBanking';
import { calculateCoins } from '../scoring/scoring';

describe('runDelta', () => {
  it('pays out the whole run the first time it is banked', () => {
    const run = { score: 2495, lines: 7, bestCombo: 6 };
    const delta = runDelta(run, EMPTY_BANKED_RUN);

    expect(delta.coins).toBe(calculateCoins(2495, 6));
    expect(delta.xp).toBe(xpFromRun(2495, 7));
    expect(delta.lines).toBe(7);
    expect(delta.countGame).toBe(true);
  });

  it('owes nothing when the run has not progressed since the last bank', () => {
    const run = { score: 2495, lines: 7, bestCombo: 6 };
    const delta = runDelta(run, bankRun(run));

    expect(delta.coins).toBe(0);
    expect(delta.xp).toBe(0);
    expect(delta.lines).toBe(0);
    expect(delta.countGame).toBe(false);
  });

  /**
   * The bug this file exists for: a rewarded revive resumes the same run, so the
   * run ends twice. Banking it twice in full would double coins, XP, lines and
   * games played — and would let a player farm coins by reviving.
   */
  it('never pays twice for a revived run', () => {
    const first = { score: 2495, lines: 7, bestCombo: 6 };
    const second = { score: 4000, lines: 11, bestCombo: 8 };

    const firstDelta = runDelta(first, EMPTY_BANKED_RUN);
    const secondDelta = runDelta(second, bankRun(first));

    // Two commits together must equal one commit of the final state.
    const oneShot = runDelta(second, EMPTY_BANKED_RUN);
    expect(firstDelta.coins + secondDelta.coins).toBe(oneShot.coins);
    expect(firstDelta.xp + secondDelta.xp).toBe(oneShot.xp);
    expect(firstDelta.lines + secondDelta.lines).toBe(oneShot.lines);

    // And the run counts as exactly one game played.
    expect([firstDelta.countGame, secondDelta.countGame].filter(Boolean)).toHaveLength(1);
  });

  it('reconciles exactly across many revives', () => {
    const states = [
      { score: 800, lines: 2, bestCombo: 2 },
      { score: 2495, lines: 7, bestCombo: 6 },
      { score: 5100, lines: 14, bestCombo: 9 },
      { score: 9000, lines: 22, bestCombo: 12 },
    ];

    let banked = EMPTY_BANKED_RUN;
    let coins = 0;
    let xp = 0;
    let lines = 0;
    let games = 0;

    for (const state of states) {
      const delta = runDelta(state, banked);
      coins += delta.coins;
      xp += delta.xp;
      lines += delta.lines;
      if (delta.countGame) games += 1;
      banked = bankRun(state);
    }

    const final = states[states.length - 1];
    expect(coins).toBe(calculateCoins(final.score, final.bestCombo));
    expect(xp).toBe(xpFromRun(final.score, final.lines));
    expect(lines).toBe(final.lines);
    expect(games).toBe(1);
  });

  it('never goes negative if a revive somehow lowers a total', () => {
    const banked = bankRun({ score: 5000, lines: 12, bestCombo: 8 });
    const delta = runDelta({ score: 100, lines: 1, bestCombo: 1 }, banked);

    expect(delta.coins).toBe(0);
    expect(delta.xp).toBe(0);
    expect(delta.lines).toBe(0);
  });

  it('credits a combo improvement made after a revive', () => {
    const banked = bankRun({ score: 2000, lines: 5, bestCombo: 3 });
    const delta = runDelta({ score: 2000, lines: 5, bestCombo: 9 }, banked);
    expect(delta.coins).toBeGreaterThan(0);
  });
});
