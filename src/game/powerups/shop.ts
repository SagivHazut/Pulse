import type { PowerUpKind } from '../../types';

/**
 * Buying power-ups with earned coins.
 *
 * This is the one place coins buy something that affects a run rather than how
 * it looks. It stays fair because coins cannot be bought with money — there is no
 * IAP anywhere in the game — so every power-up is paid for with play. The rule
 * being protected is "no pay-to-win", not "no spending".
 *
 * Prices are set against the earn rate: a decent run yields ~83 coins, so a bomb
 * costs roughly a run and a half. Cheap enough to use, dear enough to weigh
 * against a theme.
 */
export const POWER_UP_PRICES: Readonly<Record<PowerUpKind, number>> = {
  bomb: 120,
  lightning: 150,
  shuffle: 80,
};

/** Buying in bulk saves a fifth. */
export const BUNDLE = { quantity: 5, discount: 0.2 } as const;

/**
 * Total cost for `quantity` of `kind`.
 *
 * The bundle discount applies per whole bundle, so buying 5 is cheaper per unit
 * than buying 5 singles, and buying 7 gets the discount on the first 5 only.
 */
export function powerUpPrice(kind: PowerUpKind, quantity: number): number {
  const unit = POWER_UP_PRICES[kind];
  const count = Math.max(0, Math.floor(quantity));
  if (count === 0) return 0;

  const bundles = Math.floor(count / BUNDLE.quantity);
  const singles = count % BUNDLE.quantity;
  const bundleCost = bundles * BUNDLE.quantity * unit * (1 - BUNDLE.discount);

  return Math.round(bundleCost + singles * unit);
}

/** Can the player afford this purchase? */
export function canAfford(kind: PowerUpKind, quantity: number, coins: number): boolean {
  return coins >= powerUpPrice(kind, quantity);
}
