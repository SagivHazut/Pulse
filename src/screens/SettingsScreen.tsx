import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedBackdrop } from '../components/animations/AnimatedBackdrop';
import { IconButton } from '../components/ui/IconButton';
import { PressableScale } from '../components/ui/PressableScale';
import { Toggle } from '../components/ui/Toggle';
import { ACHIEVEMENTS } from '../game/achievements';
import { levelProgress } from '../game/progression';
import { useTheme } from '../hooks/useTheme';
import {
  AD_FORMATS,
  consentState,
  currentAdProvider,
  openPrivacyOptions,
  privacyOptionsAvailable,
  usingTestAdUnits,
} from '../services/ads';
import { storageBackend } from '../services/storage';
import { usePlayerStore } from '../stores/usePlayerStore';
import { useRouterStore } from '../stores/useRouterStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { showToast } from '../stores/useUiStore';
import { APP_VERSION } from '../constants/app';
import { GLYPH } from '../theme/glyphs';
import { FONT_SIZE, FONT_WEIGHT, RADIUS, SPACING } from '../theme/tokens';

export function SettingsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const go = useRouterStore((s) => s.go);
  const back = useRouterStore((s) => s.back);

  const settings = useSettingsStore();
  const xp = usePlayerStore((s) => s.xp);
  const totalGames = usePlayerStore((s) => s.totalGames);
  const totalLines = usePlayerStore((s) => s.totalLinesCleared);
  const bestCombo = usePlayerStore((s) => s.bestCombo);
  const unlockedAchievements = usePlayerStore((s) => s.unlockedAchievements);

  const progress = levelProgress(xp);

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <AnimatedBackdrop animated={false} />

      <View style={[styles.header, { paddingTop: insets.top + SPACING.xs }]}>
        <IconButton glyph={GLYPH.back} label="Back" onPress={back} />
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Settings</Text>
        <View style={{ width: 42 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + SPACING.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <Section title="Level">
          <View style={styles.levelRow}>
            <Text style={[styles.levelValue, { color: theme.colors.accent }]}>
              {progress.level}
            </Text>
            <View style={{ flex: 1, gap: 6 }}>
              <View style={[styles.track, { backgroundColor: theme.colors.surfaceSecondary }]}>
                <View
                  style={[
                    styles.fill,
                    {
                      backgroundColor: theme.colors.accent,
                      width: `${Math.round(progress.progress * 100)}%`,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.hint, { color: theme.colors.textMuted }]}>
                {progress.xpIntoLevel} / {progress.xpForNextLevel} XP to level{' '}
                {progress.level + 1}
              </Text>
            </View>
          </View>
        </Section>

        <Section title="Audio & feedback">
          <Toggle
            label="Sound effects"
            value={settings.soundEnabled}
            onChange={settings.setSound}
          />
          <Toggle label="Music" value={settings.musicEnabled} onChange={settings.setMusic} />
          <Toggle
            label="Haptics"
            description="Vibration on placement, clears and combos"
            value={settings.hapticsEnabled}
            onChange={settings.setHaptics}
          />
        </Section>

        <Section title="Accessibility">
          <Toggle
            label="Reduced motion"
            description="Removes shakes, particles and drifting backgrounds"
            value={settings.reducedMotion}
            onChange={settings.setReducedMotion}
          />
        </Section>

        <Section title="Stats">
          <StatRow label="Games played" value={totalGames.toLocaleString()} />
          <StatRow label="Lines cleared" value={totalLines.toLocaleString()} />
          <StatRow label="Best combo" value={bestCombo > 0 ? `x${bestCombo}` : '—'} />
          <StatRow
            label="Achievements"
            value={`${unlockedAchievements.length} / ${ACHIEVEMENTS.length}`}
          />
        </Section>

        <Section title="Achievements">
          <View style={styles.achievements}>
            {ACHIEVEMENTS.map((achievement) => {
              const owned = unlockedAchievements.includes(achievement.id);
              return (
                <View
                  key={achievement.id}
                  // Without `accessible`, iOS never treats this as one element:
                  // VoiceOver reads the glyph and the title separately and the
                  // label describing the achievement is never spoken.
                  accessible
                  accessibilityLabel={`${achievement.title}. ${achievement.description}. ${
                    owned ? 'Unlocked' : 'Locked'
                  }`}
                  style={[
                    styles.achievement,
                    {
                      backgroundColor: theme.colors.surfaceSecondary,
                      opacity: owned ? 1 : 0.4,
                      borderColor: owned ? theme.colors.success : 'transparent',
                    },
                  ]}
                >
                  {/*
                    The colour is not optional: without it the glyph falls back to
                    the platform default (black), which is invisible on these dark
                    cards. Emoji hid the bug — they ignore colour — so only the
                    geometric glyphs disappeared, leaving a grid where two badges
                    were vivid and the rest were blank.
                  */}
                  <Text
                    style={{
                      fontSize: FONT_SIZE.heading,
                      color: owned ? theme.colors.success : theme.colors.textSecondary,
                    }}
                  >
                    {achievement.glyph}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={{
                      fontSize: 10,
                      fontWeight: FONT_WEIGHT.bold,
                      color: theme.colors.textSecondary,
                    }}
                  >
                    {achievement.title}
                  </Text>
                </View>
              );
            })}
          </View>
        </Section>

        <Section title="Legal">
          {/*
            Hidden rather than shown-and-broken when unconfigured. A "Privacy
            policy" row that opens nothing is worse than no row; `npm run
            preflight` fails while these are empty, so a release cannot ship
            without them.
          */}
          {/*
            Opens the policy inside the app rather than handing it to a browser.
            The text ships with the build (generated from the same Markdown as
            the hosted page), so it renders instantly, stays on theme and works
            with no connection — the hosted URL is still what the store listings
            and AdMob point at.
          */}
          <LinkRow label="Privacy policy" onPress={() => go('privacy')} />
          {/*
            Shown only where UMP says an ongoing consent control is required
            (EEA/UK). That is a legal obligation rather than a nicety, which is
            why it survives even though the app sells nothing — unlike "Restore
            purchases", which was removed because there is no IAP to restore.
          */}
          {privacyOptionsAvailable() ? (
            <LinkRow
              label="Ad preferences"
              onPress={() => {
                void openPrivacyOptions().then((opened) => {
                  if (!opened) showToast('Ad preferences are unavailable here', 'info');
                });
              }}
            />
          ) : null}
        </Section>

        <Text style={[styles.version, { color: theme.colors.textMuted }]}>
          Pulse Blocks {APP_VERSION} · storage: {storageBackend()} · ads: {currentAdProvider()}
          {currentAdProvider() === 'admob' && usingTestAdUnits() ? ' (test units)' : ''}
          {` · ${[AD_FORMATS.rewarded && 'rewarded', AD_FORMATS.interstitial && 'interstitial']
            .filter(Boolean)
            .join(' + ') || 'none'}`}
          {consentState().gathered
            ? ` · ${consentState().personalized ? 'personalised' : 'non-personalised'}`
            : ''}
        </Text>

        <PressableScale onPress={() => go('themes')} sound={false} style={styles.themeLink}>
          <Text style={{ color: theme.colors.accent, fontWeight: FONT_WEIGHT.bold }}>
            Change theme →
          </Text>
        </PressableScale>
      </ScrollView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
      <Text style={[styles.sectionTitle, { color: theme.colors.textMuted }]}>
        {title.toUpperCase()}
      </Text>
      {children}
    </View>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={styles.statRow}>
      <Text style={{ color: theme.colors.textSecondary, fontSize: FONT_SIZE.body }}>{label}</Text>
      <Text
        style={{
          color: theme.colors.textPrimary,
          fontSize: FONT_SIZE.body,
          fontWeight: FONT_WEIGHT.bold,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function LinkRow({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <PressableScale onPress={onPress} scaleTo={0.99} style={styles.statRow}>
      <Text style={{ color: theme.colors.textSecondary, fontSize: FONT_SIZE.body }}>{label}</Text>
      <Text style={{ color: theme.colors.textMuted, fontSize: FONT_SIZE.body }}>›</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  title: { fontSize: FONT_SIZE.title, fontWeight: FONT_WEIGHT.heavy },
  list: { padding: SPACING.md, gap: SPACING.sm },
  section: { borderRadius: RADIUS.lg, padding: SPACING.md, gap: SPACING.xs },
  sectionTitle: {
    fontSize: FONT_SIZE.micro,
    fontWeight: FONT_WEIGHT.bold,
    letterSpacing: 1.6,
    marginBottom: 2,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
  },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  levelValue: { fontSize: FONT_SIZE.heading, fontWeight: FONT_WEIGHT.heavy, minWidth: 44 },
  track: { height: 8, borderRadius: RADIUS.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: RADIUS.pill },
  hint: { fontSize: FONT_SIZE.micro },
  achievements: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  achievement: {
    width: 76,
    height: 62,
    borderRadius: RADIUS.sm,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: 4,
  },
  version: { textAlign: 'center', fontSize: FONT_SIZE.micro, marginTop: SPACING.xs },
  themeLink: { alignItems: 'center', paddingVertical: SPACING.xs },
});
