import { calculateCoins } from '../scoring/scoring';
import { POWER_UP_KINDS } from '../powerups/powerups';
import { BUNDLE, POWER_UP_PRICES, canAfford, powerUpPrice } from '../powerups/shop';

describe('powerUpPrice', () => {
  it('charges the unit price for one', () => {
    for (const kind of POWER_UP_KINDS) {
      expect(powerUpPrice(kind, 1)).toBe(POWER_UP_PRICES[kind]);
    }
  });

  it('is free for nothing, and refuses to pay for negatives', () => {
    for (const kind of POWER_UP_KINDS) {
      expect(powerUpPrice(kind, 0)).toBe(0);
      expect(powerUpPrice(kind, -3)).toBe(0);
    }
  });

  it('discounts a full bundle', () => {
    for (const kind of POWER_UP_KINDS) {
      const singles = POWER_UP_PRICES[kind] * BUNDLE.quantity;
      const bundle = powerUpPrice(kind, BUNDLE.quantity);
      expect(bundle).toBeLessThan(singles);
      expect(bundle).toBe(Math.round(singles * (1 - BUNDLE.discount)));
    }
  });

  it('applies the discount per whole bundle only', () => {
    const kind = 'bomb' as const;
    const unit = POWER_UP_PRICES[kind];
    // 7 = one discounted bundle of 5, plus two at full price.
    expect(powerUpPrice(kind, 7)).toBe(
      Math.round(BUNDLE.quantity * unit * (1 - BUNDLE.discount) + 2 * unit),
    );
  });

  it('never prices a larger quantity below a smaller one', () => {
    for (const kind of POWER_UP_KINDS) {
      for (let n = 1; n < 20; n += 1) {
        expect(powerUpPrice(kind, n + 1)).toBeGreaterThanOrEqual(powerUpPrice(kind, n));
      }
    }
  });

  it('ignores fractional quantities rather than charging for them', () => {
    expect(powerUpPrice('bomb', 2.9)).toBe(powerUpPrice('bomb', 2));
  });
});

describe('canAfford', () => {
  it('is exact at the boundary', () => {
    const price = powerUpPrice('bomb', 1);
    expect(canAfford('bomb', 1, price)).toBe(true);
    expect(canAfford('bomb', 1, price - 1)).toBe(false);
  });
});

/**
 * Power-ups now compete with the cosmetic ladder for the same coins. That is the
 * intended trade, but a single power-up must stay small against a run's earnings
 * or it becomes the only thing anyone ever spends on.
 */
describe('power-ups sit sensibly against the earn rate', () => {
  const decentRunCoins = calculateCoins(5000, 6);

  it('costs a couple of runs at most for a single power-up', () => {
    for (const kind of POWER_UP_KINDS) {
      const runs = powerUpPrice(kind, 1) / decentRunCoins;
      expect(runs).toBeGreaterThan(0.5);
      expect(runs).toBeLessThan(2.5);
    }
  });

  it('stays cheaper than the first paid theme, so cosmetics remain a real goal', () => {
    for (const kind of POWER_UP_KINDS) {
      expect(powerUpPrice(kind, 1)).toBeLessThan(400);
    }
  });
});
