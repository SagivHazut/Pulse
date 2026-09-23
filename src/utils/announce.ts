import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

/**
 * Announce a changing value to a screen reader.
 *
 * `accessibilityLiveRegion` is **Android-only**. On iOS the prop is ignored
 * outright, so the score, the toasts and the daily reward — all marked as
 * polite live regions — were never announced at all on half the install base,
 * while the README claimed live regions worked throughout.
 *
 * Android keeps using the live region: the platform coalesces those far better
 * than repeated announcements would, and a player placing pieces quickly should
 * not hear every intermediate score. iOS gets an explicit announcement instead,
 * which is the only equivalent React Native exposes.
 *
 * The announcement is made only when a screen reader is actually running.
 * `announceForAccessibility` is a no-op otherwise, but checking first keeps the
 * app from queueing speech for a player who will never hear it.
 */
export function useAccessibilityAnnounce(message: string | null | undefined): void {
  const announced = useRef<string | null>(null);

  useEffect(() => {
    // Android already announces this through the live region on the element.
    if (Platform.OS === 'android') return;
    if (!message || message === announced.current) return;

    announced.current = message;
    let cancelled = false;

    AccessibilityInfo.isScreenReaderEnabled()
      .then((enabled) => {
        if (enabled && !cancelled) AccessibilityInfo.announceForAccessibility(message);
      })
      .catch(() => {
        // An unavailable accessibility bridge is not worth failing a render for.
      });

    return () => {
      cancelled = true;
    };
  }, [message]);
}
