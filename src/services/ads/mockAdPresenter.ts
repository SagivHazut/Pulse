import type { RewardType } from '../../types';

/**
 * Bridge between the mock ad provider and a visible placeholder.
 *
 * The mock used to be an invisible 900ms delay that always resolved as "watched",
 * which made every rewarded button look broken — the screen blinked and a reward
 * appeared. Worse, the only way to exercise the *dismissed* path was to wait for a
 * random 5% roll.
 *
 * Now the provider hands the request to this presenter and waits for a real
 * decision, so a developer can deliberately watch to completion or close early
 * and see exactly what the game does in each case.
 */

export type MockAdOutcome = 'completed' | 'dismissed';

export type MockAdRequest = {
  id: number;
  format: 'rewarded' | 'interstitial';
  /** Which reward is on offer, for rewarded ads. */
  rewardType?: RewardType;
  /** How long the placeholder insists you watch before the reward unlocks. */
  durationMs: number;
  /** When the ad was presented, so the countdown is derived rather than stored. */
  startedAt: number;
};

type Listener = (request: MockAdRequest | null) => void;

let current: MockAdRequest | null = null;
let resolveCurrent: ((outcome: MockAdOutcome) => void) | null = null;
let nextId = 0;
const listeners = new Set<Listener>();

function emit(): void {
  for (const listener of listeners) {
    try {
      listener(current);
    } catch {
      // A broken subscriber must not wedge the ad flow.
    }
  }
}

/** Show the placeholder and resolve once the viewer decides. */
export function presentMockAd(
  format: MockAdRequest['format'],
  options: { rewardType?: RewardType; durationMs?: number } = {},
): Promise<MockAdOutcome> {
  // Only one ad can be on screen; a second request resolves the first as dismissed.
  if (resolveCurrent) resolveCurrent('dismissed');

  nextId += 1;
  current = {
    id: nextId,
    format,
    rewardType: options.rewardType,
    durationMs: options.durationMs ?? (format === 'rewarded' ? 3000 : 1500),
    startedAt: Date.now(),
  };
  emit();

  return new Promise<MockAdOutcome>((resolve) => {
    resolveCurrent = (outcome) => {
      resolveCurrent = null;
      current = null;
      emit();
      resolve(outcome);
    };
  });
}

/** Called by the overlay when the viewer finishes or closes the placeholder. */
export function resolveMockAd(outcome: MockAdOutcome): void {
  resolveCurrent?.(outcome);
}

export function subscribeMockAd(listener: Listener): () => void {
  listeners.add(listener);
  listener(current);
  return () => {
    listeners.delete(listener);
  };
}

export function currentMockAd(): MockAdRequest | null {
  return current;
}
