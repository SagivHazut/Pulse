import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Confetti } from '../components/animations/Confetti';
import { RewardAmount, RewardBurst } from '../components/animations/RewardBurst';
import { Button } from '../components/ui/Button';
import { Sheet } from '../components/ui/Sheet';
import { DAILY_REWARD } from '../constants/config';
import { useTheme } from '../hooks/useTheme';
import { useAccessibilityAnnounce } from '../utils/announce';
import { showRewarded } from '../services/ads';
import { playSfx } from '../services/audio';
import { haptics } from '../services/haptics';
import { useMonetizationStore } from '../stores/useMonetizationStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { usePlayerStore } from '../stores/usePlayerStore';
import { showToast } from '../stores/useUiStore';
import { FONT_SIZE, FONT_WEIGHT, RADIUS, SPACING } from '../theme/tokens';

type Props = { visible: boolean; onClose: () => void };

/** How long the reveal stays up before the sheet closes itself. */
const REVEAL_MS = 2600;

type Claimed = { amount: number; day: number; doubled: boolean };

/**
 * Seven-day coin cycle, with an optional rewarded doubler.
 *
 * Claiming does not dismiss the sheet. It used to, which meant the only feedback
 * was a coin sound, a haptic and a toast behind the closing sheet — invisible
 * with sound off, and on a simulator that is no feedback at all. Now the sheet
 * reveals what you won and closes itself afterwards.
 */
export function DailyRewardSheet({ visible, onClose }: Props) {
  const theme = useTheme();
  const dailyState = usePlayerStore((s) => s.dailyState);
  const claimDaily = usePlayerStore((s) => s.claimDaily);
  // The streak *after* the claim lands — the reveal is shown once `claimDaily`
  // has already written it, so this is the number the player just earned.
  const claimedStreak = usePlayerStore((s) => s.currentStreak);
  const setAdInFlight = useMonetizationStore((s) => s.setAdInFlight);
  const reducedMotion = useSettingsStore((s) => s.reducedMotion);

  const [busy, setBusy] = useState(false);
  const [claimed, setClaimed] = useState<Claimed | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const state = dailyState();

  // The reveal's live region covers Android; iOS ignores it entirely.
  useAccessibilityAnnounce(
    claimed ? `${claimed.amount} coins claimed${claimed.doubled ? ', doubled' : ''}` : null,
  );

  // Only cleanup — the timer is started from the claim handlers, not an effect.
  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );

  /**
   * Closing drops the reveal.
   *
   * HomeScreen keeps this component mounted and only toggles `visible`, so
   * without this the reveal state survived — and every later open of Daily was
   * the already-claimed reveal screen, confetti and all, instead of the
   * calendar. Every close path routes through here, and `Sheet` has no exit
   * animation, so the reset is invisible.
   */
  const handleClose = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setClaimed(null);
    setBusy(false);
    onClose();
  }, [onClose]);

  const finish = useCallback(
    (amount: number, day: number, doubled: boolean) => {
      if (amount <= 0) return;
      playSfx('coin');
      haptics.success();
      setClaimed({ amount, day, doubled });
      showToast(`+${amount.toLocaleString()} coins`, 'success');
      closeTimer.current = setTimeout(handleClose, REVEAL_MS);
    },
    [handleClose],
  );

  const handleClaim = useCallback(() => {
    const day = state.day;
    finish(claimDaily(1), day, false);
  }, [claimDaily, finish, state.day]);

  const handleDouble = useCallback(async () => {
    if (busy) return;
    const day = state.day;
    setBusy(true);
    setAdInFlight(true);
    let amount = 0;
    const result = await showRewarded('daily_double', () => {
      amount = claimDaily(2);
    });
    setAdInFlight(false);
    setBusy(false);

    if (amount > 0) {
      finish(amount, day, true);
      return;
    }
    if (result.message) showToast(result.message, 'warning');
  }, [busy, claimDaily, finish, setAdInFlight, state.day]);

  if (claimed) {
    const isMystery = claimed.day === DAILY_REWARD.cycle.length;
    return (
      <Sheet visible={visible} onClose={handleClose} title="Daily Reward">
        {(isMystery || claimed.doubled) && !reducedMotion ? (
          <Confetti colors={theme.particles} count={26} seed={claimed.amount} />
        ) : null}

        <View style={styles.reveal}>
          <RewardBurst color={theme.colors.coin} enabled={!reducedMotion} />
          <RewardAmount
            amount={claimed.amount}
            color={theme.colors.coin}
            reducedMotion={reducedMotion}
          />
          <Text
            accessibilityLiveRegion="polite"
            style={[styles.revealLabel, { color: theme.colors.textSecondary }]}
          >
            {claimed.doubled ? 'DOUBLED · ' : ''}
            {isMystery ? 'DAY 7 MYSTERY' : `DAY ${claimed.day}`}
          </Text>
        </View>

        <Text style={[styles.revealStreak, { color: theme.colors.textMuted }]}>
          {claimedStreak} day streak · come back tomorrow
        </Text>

        <Button label="NICE" fullWidth onPress={handleClose} />
      </Sheet>
    );
  }

  return (
    <Sheet visible={visible} onClose={handleClose} title="Daily Reward">
      {/*
        `state.streak`, not the stored `currentStreak`. They diverge the moment a
        day is missed: the stored value still reads 5 while `evaluateDaily` has
        already reset the cycle to day 1, so the sheet advertised a streak the
        player had just lost, beside a 50-coin day-1 reward. The evaluated value
        is the one the reward is actually computed from.
      */}
      <Text style={[styles.streak, { color: theme.colors.textMuted }]}>
        {state.streak > 0 ? `${state.streak} day streak` : 'Come back daily for bigger rewards'}
      </Text>

      <View style={styles.grid}>
        {DAILY_REWARD.cycle.map((amount, index) => {
          const day = index + 1;
          const claimed = day < state.day || (!state.claimable && day === state.day);
          const isToday = state.claimable && day === state.day;
          const isMystery = day === DAILY_REWARD.cycle.length;

          return (
            <View
              key={day}
              style={[
                styles.day,
                {
                  backgroundColor: isToday
                    ? theme.colors.accentSoft
                    : theme.colors.surfaceSecondary,
                  borderColor: isToday ? theme.colors.accent : 'transparent',
                  opacity: claimed ? 0.45 : 1,
                },
              ]}
            >
              <Text style={[styles.dayLabel, { color: theme.colors.textMuted }]}>D{day}</Text>
              <Text
                style={[
                  styles.dayValue,
                  { color: isToday ? theme.colors.accent : theme.colors.textPrimary },
                ]}
              >
                {isMystery ? '?' : amount}
              </Text>
              {claimed ? (
                <Text style={[styles.check, { color: theme.colors.success }]}>✓</Text>
              ) : null}
            </View>
          );
        })}
      </View>

      {state.claimable ? (
        <View style={styles.actions}>
          <Button
            label={`CLAIM ${state.day === DAILY_REWARD.cycle.length ? 'MYSTERY' : state.amount} COINS`}
            fullWidth
            disabled={busy}
            onPress={handleClaim}
          />
          <Button
            label="WATCH AD · DOUBLE REWARD"
            icon="▶"
            variant="secondary"
            size="sm"
            fullWidth
            disabled={busy}
            onPress={handleDouble}
          />
        </View>
      ) : (
        <Text style={[styles.done, { color: theme.colors.textSecondary }]}>
          Already claimed today — come back tomorrow.
        </Text>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  streak: { textAlign: 'center', fontSize: FONT_SIZE.caption, marginTop: -SPACING.xs },
  grid: { flexDirection: 'row', gap: 5, justifyContent: 'space-between' },
  day: {
    flex: 1,
    aspectRatio: 0.78,
    borderRadius: RADIUS.sm,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  dayLabel: { fontSize: 10, fontWeight: FONT_WEIGHT.bold, letterSpacing: 0.8 },
  dayValue: { fontSize: FONT_SIZE.caption, fontWeight: FONT_WEIGHT.heavy },
  check: { position: 'absolute', bottom: 4, fontSize: 10 },
  actions: { gap: SPACING.xs },
  reveal: {
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
  },
  revealLabel: {
    fontSize: FONT_SIZE.micro,
    fontWeight: FONT_WEIGHT.bold,
    letterSpacing: 1.8,
    marginTop: SPACING.xs,
  },
  revealStreak: {
    textAlign: 'center',
    fontSize: FONT_SIZE.caption,
    marginTop: -SPACING.xs,
  },
  done: { textAlign: 'center', fontSize: FONT_SIZE.caption, paddingVertical: SPACING.xs },
});
