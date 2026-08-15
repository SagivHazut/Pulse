import React, { useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedBackdrop } from '../components/animations/AnimatedBackdrop';
import { Tile } from '../components/game/Tile';
import { IconButton } from '../components/ui/IconButton';
import { PressableScale } from '../components/ui/PressableScale';
import { useTheme } from '../hooks/useTheme';
import { levelProgress } from '../game/progression';
import { playSfx } from '../services/audio';
import { haptics } from '../services/haptics';
import { usePlayerStore } from '../stores/usePlayerStore';
import { useRouterStore } from '../stores/useRouterStore';
import { showToast } from '../stores/useUiStore';
import { BLOCK_FINISHES, type BlockFinish } from '../theme/finishes';
import { THEMES, type Theme } from '../theme/themes';
import { GLYPH } from '../theme/glyphs';
import { ELEVATION, FONT_SIZE, FONT_WEIGHT, RADIUS, SPACING } from '../theme/tokens';
import type { BlockColorId } from '../types';

const PREVIEW_COLORS: BlockColorId[] = ['aqua', 'violet', 'coral', 'amber', 'rose'];

export function ThemesScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const go = useRouterStore((s) => s.go);

  const unlocked = usePlayerStore((s) => s.unlockedThemes);
  const selected = usePlayerStore((s) => s.selectedTheme);
  const coins = usePlayerStore((s) => s.totalCoins);
  const xp = usePlayerStore((s) => s.xp);
  const selectTheme = usePlayerStore((s) => s.selectTheme);
  const purchaseTheme = usePlayerStore((s) => s.purchaseTheme);
  const unlockedFinishes = usePlayerStore((s) => s.unlockedFinishes);
  const selectedFinish = usePlayerStore((s) => s.selectedFinish);
  const selectFinish = usePlayerStore((s) => s.selectFinish);
  const purchaseFinish = usePlayerStore((s) => s.purchaseFinish);

  const level = levelProgress(xp).level;

  const handlePress = useCallback(
    (item: Theme) => {
      if (unlocked.includes(item.id)) {
        selectTheme(item.id);
        return;
      }
      if (level < item.unlockLevel) {
        showToast(`Reach level ${item.unlockLevel} to unlock ${item.name}`, 'warning');
        return;
      }
      if (coins < item.price) {
        showToast(`Need ${(item.price - coins).toLocaleString()} more coins`, 'warning');
        return;
      }
      if (purchaseTheme(item.id)) {
        playSfx('coin');
        haptics.success();
        showToast(`${item.name} unlocked!`, 'success');
      }
    },
    [coins, level, purchaseTheme, selectTheme, unlocked],
  );

  const handleFinishPress = useCallback(
    (finish: BlockFinish) => {
      if (unlockedFinishes.includes(finish.id)) {
        selectFinish(finish.id);
        return;
      }
      if (level < finish.unlockLevel) {
        showToast(`Reach level ${finish.unlockLevel} to unlock ${finish.name}`, 'warning');
        return;
      }
      if (coins < finish.price) {
        showToast(`Need ${(finish.price - coins).toLocaleString()} more coins`, 'warning');
        return;
      }
      if (purchaseFinish(finish.id)) {
        playSfx('coin');
        haptics.success();
        showToast(`${finish.name} blocks unlocked!`, 'success');
      }
    },
    [coins, level, purchaseFinish, selectFinish, unlockedFinishes],
  );

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <AnimatedBackdrop animated={false} />

      <View style={[styles.header, { paddingTop: insets.top + SPACING.xs }]}>
        <IconButton glyph={GLYPH.back} label="Back" onPress={() => go('home')} />
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Themes</Text>
        <View
          style={[
            styles.coins,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.gridLine },
          ]}
        >
          <Text style={{ color: theme.colors.coin, fontSize: FONT_SIZE.caption }}>◉</Text>
          <Text
            style={{
              color: theme.colors.textPrimary,
              fontSize: FONT_SIZE.caption,
              fontWeight: FONT_WEIGHT.bold,
            }}
          >
            {coins.toLocaleString()}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + SPACING.xl }]}
        showsVerticalScrollIndicator={false}
      >
        {THEMES.map((item) => {
          const isUnlocked = unlocked.includes(item.id);
          const isSelected = selected === item.id;
          const levelLocked = !isUnlocked && level < item.unlockLevel;

          return (
            <PressableScale
              key={item.id}
              onPress={() => handlePress(item)}
              scaleTo={0.98}
              accessibilityLabel={`${item.name} theme${isSelected ? ', selected' : ''}${
                isUnlocked ? '' : `, locked, costs ${item.price} coins`
              }`}
              style={[
                styles.card,
                ELEVATION.card,
                {
                  backgroundColor: item.colors.surface,
                  borderColor: isSelected ? theme.colors.accent : 'transparent',
                },
              ]}
            >
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: item.colors.textPrimary }]}>
                    {item.name}
                  </Text>
                  <Text style={[styles.cardSub, { color: item.colors.textMuted }]}>
                    {item.tagline}
                  </Text>
                </View>
                {isSelected ? (
                  <Text style={[styles.tag, { color: item.colors.accent }]}>ACTIVE</Text>
                ) : isUnlocked ? (
                  <Text style={[styles.tag, { color: item.colors.textMuted }]}>OWNED</Text>
                ) : levelLocked ? (
                  <Text style={[styles.tag, { color: item.colors.warning }]}>
                    LVL {item.unlockLevel}
                  </Text>
                ) : (
                  <Text style={[styles.tag, { color: item.colors.coin }]}>
                    ◉ {item.price.toLocaleString()}
                  </Text>
                )}
              </View>

              <View
                style={[styles.preview, { backgroundColor: item.colors.boardBackground }]}
              >
                {PREVIEW_COLORS.map((colorId) => (
                  <View
                    key={colorId}
                    style={[
                      styles.swatch,
                      {
                        backgroundColor: item.blocks[colorId].base,
                        borderColor: item.blocks[colorId].light,
                      },
                    ]}
                  />
                ))}
              </View>

              {/*
                A label, not a button: the whole card is already the tap target,
                and nesting a second control inside it would give the row two
                overlapping actions and duplicate it for screen readers.
                The price is always shown, even while level-locked, so the player
                can plan for it rather than be surprised later.
              */}
              {!isUnlocked ? (
                <View
                  style={[
                    styles.cta,
                    {
                      backgroundColor: levelLocked ? 'transparent' : item.colors.accent,
                      borderColor: levelLocked ? item.colors.gridLine : 'transparent',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.ctaText,
                      {
                        color: levelLocked ? item.colors.textMuted : item.colors.accentContrast,
                      },
                    ]}
                  >
                    {levelLocked
                      ? `REACH LEVEL ${item.unlockLevel} · ◉ ${item.price.toLocaleString()}`
                      : `TAP TO UNLOCK · ◉ ${item.price.toLocaleString()}`}
                  </Text>
                </View>
              ) : null}
            </PressableScale>
          );
        })}

        <Text style={[styles.sectionLabel, { color: theme.colors.textMuted }]}>
          BLOCK STYLE
        </Text>

        <View style={styles.finishGrid}>
          {BLOCK_FINISHES.map((finish) => {
            const owned = unlockedFinishes.includes(finish.id);
            const active = selectedFinish === finish.id;
            const levelLocked = !owned && level < finish.unlockLevel;

            return (
              <PressableScale
                key={finish.id}
                onPress={() => handleFinishPress(finish)}
                scaleTo={0.97}
                accessibilityLabel={`${finish.name} block style${active ? ', selected' : ''}${
                  owned ? '' : `, locked, costs ${finish.price} coins`
                }`}
                accessibilityHint={finish.tagline}
                style={[
                  styles.finishCard,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: active ? theme.colors.accent : theme.colors.gridLine,
                    opacity: levelLocked ? 0.55 : 1,
                  },
                ]}
              >
                <View style={styles.finishPreview}>
                  {(['aqua', 'rose', 'amber'] as const).map((colorId) => (
                    <Tile
                      key={colorId}
                      // Large enough that the lip, highlight and corner radius
                      // differences between finishes are actually legible.
                      size={34}
                      skin={theme.blocks[colorId]}
                      finish={finish}
                    />
                  ))}
                </View>
                <Text style={[styles.finishName, { color: theme.colors.textPrimary }]}>
                  {finish.name}
                </Text>
                <Text
                  numberOfLines={1}
                  style={[styles.finishTag, { color: theme.colors.textMuted }]}
                >
                  {active
                    ? 'ACTIVE'
                    : owned
                      ? 'OWNED'
                      : levelLocked
                        ? `LVL ${finish.unlockLevel} · ◉ ${finish.price.toLocaleString()}`
                        : `◉ ${finish.price.toLocaleString()}`}
                </Text>
              </PressableScale>
            );
          })}
        </View>

        <Text style={[styles.footnote, { color: theme.colors.textMuted }]}>
          Coins are cosmetic only — nothing here affects scoring.
        </Text>
      </ScrollView>
    </View>
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
  coins: {
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 7,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
  },
  list: { padding: SPACING.md, gap: SPACING.sm },
  card: { borderRadius: RADIUS.xl, borderWidth: 2, padding: SPACING.md, gap: SPACING.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  cardTitle: { fontSize: FONT_SIZE.label, fontWeight: FONT_WEIGHT.heavy },
  cardSub: { fontSize: FONT_SIZE.caption },
  tag: { fontSize: FONT_SIZE.micro, fontWeight: FONT_WEIGHT.heavy, letterSpacing: 1.2 },
  preview: {
    flexDirection: 'row',
    gap: SPACING.xs,
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
  },
  swatch: { width: 34, height: 34, borderRadius: 9, borderWidth: 1 },
  cta: {
    borderRadius: RADIUS.sm,
    borderWidth: 1.5,
    paddingVertical: 11,
    alignItems: 'center',
  },
  ctaText: {
    fontSize: FONT_SIZE.caption,
    fontWeight: FONT_WEIGHT.heavy,
    letterSpacing: 0.8,
  },
  footnote: {
    textAlign: 'center',
    fontSize: FONT_SIZE.micro,
    marginTop: SPACING.xs,
  },
  sectionLabel: {
    fontSize: FONT_SIZE.micro,
    fontWeight: FONT_WEIGHT.bold,
    letterSpacing: 1.6,
    marginTop: SPACING.md,
    marginBottom: -SPACING.xxs,
  },
  finishGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  finishCard: {
    flexBasis: '48%',
    flexGrow: 1,
    borderRadius: RADIUS.lg,
    borderWidth: 2,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    gap: 4,
  },
  finishPreview: { flexDirection: 'row', gap: 5, marginBottom: 2 },
  finishName: { fontSize: FONT_SIZE.body, fontWeight: FONT_WEIGHT.bold },
  finishTag: { fontSize: FONT_SIZE.micro, fontWeight: FONT_WEIGHT.bold, letterSpacing: 0.8 },
});
