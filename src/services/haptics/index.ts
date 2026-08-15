import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Every haptic in the game goes through here, so the user's toggle is honoured
 * in exactly one place and a missing/failing haptics driver can never crash a
 * turn.
 */

let enabled = true;

export function setHapticsEnabled(value: boolean): void {
  enabled = value;
}

export function hapticsEnabled(): boolean {
  return enabled;
}

const supported = Platform.OS === 'ios' || Platform.OS === 'android';

function run(fn: () => Promise<void>): void {
  if (!enabled || !supported) return;
  try {
    void fn().catch(() => undefined);
  } catch {
    // Haptics are a nicety; never let them take the game down.
  }
}

export const haptics = {
  /** Piece pickup, tray interactions. */
  light(): void {
    run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
  },
  /** Successful placement, line clear. */
  medium(): void {
    run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
  },
  /** Big combo, game over, bomb. */
  heavy(): void {
    run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
  },
  selection(): void {
    run(() => Haptics.selectionAsync());
  },
  success(): void {
    run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
  },
  warning(): void {
    run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
  },
  error(): void {
    run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
  },

  /** Combo feedback scaled to how big the chain is. */
  combo(level: number): void {
    if (level >= 10) {
      this.heavy();
      setTimeout(() => this.heavy(), 70);
    } else if (level >= 5) {
      this.heavy();
    } else if (level >= 2) {
      this.medium();
    } else {
      this.light();
    }
  },
};
