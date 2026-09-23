import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '../components/ui/IconButton';
import { APP_NAME } from '../constants/app';
import { PRIVACY_POLICY, PRIVACY_UPDATED, type LegalBlock } from '../constants/legalContent';
import { useTheme } from '../hooks/useTheme';
import { useRouterStore } from '../stores/useRouterStore';
import { FONT_SIZE, FONT_WEIGHT, SPACING } from '../theme/tokens';
import { GLYPH } from '../theme/glyphs';

/**
 * The privacy policy, rendered in the app rather than handed to a browser.
 *
 * It used to open the hosted page through `Linking`, which leaves the game,
 * shows a URL bar, and fails outright with no connection — on a plane, the one
 * control in Settings that must always work would do nothing. The text is
 * generated into `constants/legalContent.ts` from the same Markdown that builds
 * the hosted page (`npm run legal`), so the two cannot disagree.
 *
 * The hosted copy still exists and still matters: both store listings and the
 * AdMob account require a public URL, and none of them will accept a screen
 * inside the binary.
 */
export function PrivacyScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const back = useRouterStore((s) => s.back);

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + SPACING.xs }]}>
        <IconButton glyph={GLYPH.back} onPress={back} label="Back" />
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Privacy</Text>
        {/* Balances the back button so the title stays optically centred. */}
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + SPACING.xxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {PRIVACY_POLICY.map((block, index) => (
          <Block key={index} block={block} />
        ))}

        {/*
          No URL printed here on purpose. The hosted copy is what the store
          listings and AdMob point at, but showing a domain inside the app is
          exactly what rendering the policy natively was meant to avoid.
        */}
        <Text style={[styles.footer, { color: theme.colors.textMuted }]}>
          {APP_NAME} · updated {PRIVACY_UPDATED}
        </Text>
      </ScrollView>
    </View>
  );
}

function Block({ block }: { block: LegalBlock }) {
  const theme = useTheme();

  /**
   * Bold runs are nested `Text`, which is the only way inline emphasis composes
   * in React Native — a sibling `Text` would break the line wrapping.
   */
  const content = block.spans.map((span, i) =>
    span.bold ? (
      <Text key={i} style={styles.bold}>
        {span.text}
      </Text>
    ) : (
      span.text
    ),
  );

  if (block.kind === 'h1') {
    // The document's own title; the header already says "Privacy", so this
    // renders as the lead rather than repeating a heading.
    return (
      <Text style={[styles.h1, { color: theme.colors.textPrimary }]}>{content}</Text>
    );
  }

  if (block.kind === 'h2' || block.kind === 'h3' || block.kind === 'h4') {
    return (
      <Text
        accessibilityRole="header"
        style={[
          block.kind === 'h2' ? styles.h2 : styles.h3,
          { color: theme.colors.accent },
        ]}
      >
        {content}
      </Text>
    );
  }

  if (block.kind === 'li') {
    return (
      <View style={styles.listRow}>
        <Text style={[styles.bullet, { color: theme.colors.accent }]}>•</Text>
        <Text style={[styles.body, styles.listText, { color: theme.colors.textSecondary }]}>
          {content}
        </Text>
      </View>
    );
  }

  return (
    <Text style={[styles.body, { color: theme.colors.textSecondary }]}>{content}</Text>
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
  headerSpacer: { width: 42 },
  content: { paddingHorizontal: SPACING.lg },
  h1: {
    fontSize: FONT_SIZE.heading,
    fontWeight: FONT_WEIGHT.heavy,
    marginBottom: SPACING.xs,
    lineHeight: FONT_SIZE.heading * 1.2,
  },
  h2: {
    fontSize: FONT_SIZE.label,
    fontWeight: FONT_WEIGHT.heavy,
    marginTop: SPACING.lg,
    marginBottom: SPACING.xs,
  },
  h3: {
    fontSize: FONT_SIZE.body,
    fontWeight: FONT_WEIGHT.bold,
    marginTop: SPACING.md,
    marginBottom: SPACING.xxs,
  },
  body: { fontSize: FONT_SIZE.body, lineHeight: FONT_SIZE.body * 1.55, marginBottom: SPACING.sm },
  bold: { fontWeight: FONT_WEIGHT.bold },
  listRow: { flexDirection: 'row', paddingRight: SPACING.sm },
  bullet: { fontSize: FONT_SIZE.body, lineHeight: FONT_SIZE.body * 1.55, width: 18 },
  listText: { flex: 1, marginBottom: SPACING.xxs },
  footer: {
    fontSize: FONT_SIZE.micro,
    lineHeight: FONT_SIZE.micro * 1.5,
    marginTop: SPACING.xl,
    textAlign: 'center',
  },
});
