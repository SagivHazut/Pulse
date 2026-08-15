import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useTheme } from '../../hooks/useTheme';
import {
  resolveMockAd,
  subscribeMockAd,
  type MockAdRequest,
} from '../../services/ads/mockAdPresenter';
import { FONT_SIZE, FONT_WEIGHT, RADIUS, SPACING } from '../../theme/tokens';
import { Button } from '../ui/Button';

/**
 * The visible stand-in for a real ad, shown only by the mock provider.
 *
 * It exists so development matches production behaviour: something covers the
 * screen, the reward unlocks only after the countdown, and closing early earns
 * nothing. Previously the mock was an invisible delay that always paid out, which
 * made rewarded buttons look broken and left the dismissed path untested.
 *
 * Never reachable in a release build — the ad facade only selects the mock
 * provider in development.
 */
export function MockAdOverlay() {
  const theme = useTheme();
  const [request, setRequest] = useState<MockAdRequest | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => subscribeMockAd(setRequest), []);

  // The countdown is derived from the request's own start time, so the ticker only
  // has to advance the clock — no state to reset when a new ad is presented.
  useEffect(() => {
    if (!request) return;
    const timer = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(timer);
  }, [request]);

  const progress = useSharedValue(0);
  useEffect(() => {
    if (!request) return;
    progress.value = 0;
    progress.value = withTiming(1, { duration: request.durationMs });
  }, [request, progress]);

  const barStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  if (!request) return null;

  // Clamped both ways: a stale clock shows the full duration rather than a
  // negative countdown or an instantly-unlocked reward.
  const elapsed = Math.min(request.durationMs, Math.max(0, now - request.startedAt));
  const remaining = Math.ceil((request.durationMs - elapsed) / 1000);
  const watched = remaining <= 0;
  const isRewarded = request.format === 'rewarded';

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View style={[styles.root, { backgroundColor: '#0B0B10' }]}>
        <View style={styles.badgeRow}>
          <View style={[styles.badge, { borderColor: theme.colors.warning }]}>
            <Text style={[styles.badgeText, { color: theme.colors.warning }]}>
              TEST AD · NOT A REAL AD
            </Text>
          </View>
        </View>

        <View style={styles.middle}>
          <Text style={[styles.format, { color: theme.colors.textMuted }]}>
            {isRewarded ? 'REWARDED' : 'INTERSTITIAL'}
          </Text>
          <Text style={[styles.headline, { color: '#FFFFFF' }]}>
            {isRewarded ? request.rewardType?.replace(/_/g, ' ').toUpperCase() : 'BETWEEN RUNS'}
          </Text>
          <Text style={[styles.hint, { color: theme.colors.textMuted }]}>
            {watched
              ? isRewarded
                ? 'Reward earned — close to collect'
                : 'You can close this now'
              : `${remaining}s remaining`}
          </Text>

          <View style={[styles.track, { backgroundColor: 'rgba(255,255,255,0.12)' }]}>
            <Animated.View
              style={[styles.fill, { backgroundColor: theme.colors.warning }, barStyle]}
            />
          </View>
        </View>

        <View style={styles.actions}>
          {watched ? (
            <Button
              label={isRewarded ? 'COLLECT REWARD' : 'CLOSE'}
              variant="reward"
              size="lg"
              fullWidth
              onPress={() => resolveMockAd('completed')}
            />
          ) : (
            <Button
              label="CLOSE EARLY · NO REWARD"
              variant="secondary"
              fullWidth
              onPress={() => resolveMockAd('dismissed')}
            />
          )}
          <Text style={[styles.footnote, { color: theme.colors.textMuted }]}>
            Placeholder shown because the real ad SDK is not available in this build.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xxl,
    justifyContent: 'space-between',
  },
  badgeRow: { alignItems: 'center' },
  badge: {
    borderWidth: 1.5,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
  },
  badgeText: { fontSize: FONT_SIZE.micro, fontWeight: FONT_WEIGHT.heavy, letterSpacing: 1.2 },
  middle: { alignItems: 'center', gap: SPACING.xs },
  format: { fontSize: FONT_SIZE.micro, fontWeight: FONT_WEIGHT.bold, letterSpacing: 2 },
  headline: { fontSize: FONT_SIZE.heading, fontWeight: FONT_WEIGHT.heavy, textAlign: 'center' },
  hint: { fontSize: FONT_SIZE.caption, marginBottom: SPACING.sm },
  track: {
    alignSelf: 'stretch',
    height: 6,
    borderRadius: RADIUS.pill,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: RADIUS.pill },
  actions: { gap: SPACING.xs },
  footnote: { textAlign: 'center', fontSize: FONT_SIZE.micro },
});
