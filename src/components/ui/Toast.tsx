import React, { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../hooks/useTheme';
import { useAccessibilityAnnounce } from '../../utils/announce';
import { FadeInView } from './FadeInView';
import { ELEVATION, FONT_SIZE, FONT_WEIGHT, RADIUS, SPACING } from '../../theme/tokens';

export type ToastMessage = {
  id: number;
  text: string;
  tone?: 'info' | 'success' | 'warning';
} | null;

type Props = {
  message: ToastMessage;
  onDismiss: () => void;
  durationMs?: number;
};

/** Non-blocking status line — ad failures, power-up awards, purchases. */
export function Toast({ message, onDismiss, durationMs = 2400 }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  // The live region below covers Android; iOS ignores it entirely.
  useAccessibilityAnnounce(message?.text);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(timer);
  }, [message, durationMs, onDismiss]);

  if (!message) return null;

  const tint =
    message.tone === 'success'
      ? theme.colors.success
      : message.tone === 'warning'
        ? theme.colors.warning
        : theme.colors.accent;

  return (
    <FadeInView
      key={message.id}
      offsetY={-14}
      duration={220}
      pointerEvents="none"
      style={[
        styles.toast,
        ELEVATION.card,
        {
          // Below the HUD's control row, not over it. Toasts usually explain why
          // the coin count just changed, so covering the coin count is the one
          // thing this must not do. Briefly overlapping the score is harmless —
          // it is large, always on screen, and back a moment later.
          top: insets.top + 52,
          backgroundColor: theme.colors.surfaceElevated,
          borderColor: tint,
        },
      ]}
    >
      {/* The live region covers Android; iOS needs the explicit announcement. */}
      <Text
        accessibilityLiveRegion="polite"
        style={[styles.text, { color: theme.colors.textPrimary }]}
      >
        {message.text}
      </Text>
    </FadeInView>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    maxWidth: '88%',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.pill,
    borderWidth: 1.5,
    zIndex: 2000,
  },
  text: { fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.bold, textAlign: 'center' },
});
