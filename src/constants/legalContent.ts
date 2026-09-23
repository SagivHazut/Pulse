/**
 * GENERATED FILE — do not edit.
 *
 * Built from legal/privacy-policy.md by scripts/build-legal-pages.js (`npm run legal`),
 * which renders the same source to docs/privacy.html. Edit the Markdown and
 * re-run; editing this file loses the change on the next build and puts the
 * app out of step with the hosted policy.
 */

export type LegalSpan = { text: string; bold?: boolean };

export type LegalBlock = {
  kind: 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'li';
  spans: LegalSpan[];
};

/** Shown in the app so a reader can tell which revision they are looking at. */
export const PRIVACY_UPDATED = "15 August 2026";

export const PRIVACY_POLICY: readonly LegalBlock[] = [
  { kind: 'h1', spans: [{ text: "Privacy Policy for Pulse Blocks" }] },
  { kind: 'p', spans: [{ text: "Last updated: 15 August 2026", bold: true }] },
  { kind: 'h2', spans: [{ text: "The short version" }] },
  { kind: 'p', spans: [{ text: "Pulse Blocks does not ask who you are. There is no account, no sign-in, and no server that stores your progress. Your scores, coins and settings live on your device and nowhere else." }] },
  { kind: 'p', spans: [{ text: "The one exception is advertising. The game shows ads from Google AdMob, and Google collects some information to deliver and measure them. That is described in full below." }] },
  { kind: 'h2', spans: [{ text: "What stays on your device" }] },
  { kind: 'p', spans: [{ text: "The following is saved locally and never transmitted:" }] },
  { kind: 'li', spans: [{ text: "Your high scores for each mode, and your saved game in progress" }] },
  { kind: 'li', spans: [{ text: "Coins, level, XP and unlocked achievements" }] },
  { kind: 'li', spans: [{ text: "Unlocked themes and block styles, and which one is active" }] },
  { kind: 'li', spans: [{ text: "Your sound, music, haptics and reduced-motion preferences" }] },
  { kind: 'li', spans: [{ text: "Daily reward streak and the date you last claimed" }] },
  { kind: 'p', spans: [{ text: "Deleting the app deletes all of it. There is no backup and no way for us to recover it, because we never receive it." }] },
  { kind: 'h2', spans: [{ text: "Advertising" }] },
  { kind: 'p', spans: [{ text: "Pulse Blocks shows rewarded ads (which you choose to watch, in exchange for an in-game reward) and may show ads between games. These are served by " }, { text: "Google AdMob", bold: true }, { text: "." }] },
  { kind: 'p', spans: [{ text: "To serve and measure ads, Google may collect and process:" }] },
  { kind: 'li', spans: [{ text: "A device advertising identifier (the Advertising ID on Android, or the Identifier for Advertisers on iOS)" }] },
  { kind: 'li', spans: [{ text: "Device information such as model, operating system version and language" }] },
  { kind: 'li', spans: [{ text: "Approximate location derived from your IP address" }] },
  { kind: 'li', spans: [{ text: "Information about ads shown, including views and interactions" }] },
  { kind: 'p', spans: [{ text: "We do not receive this information, and we cannot connect it to you. How Google uses it is described in " }, { text: "Google's Privacy & Terms", bold: true }, { text: " (https://policies.google.com/technologies/partner-sites) and in " }, { text: "How Google uses information from partner sites and apps", bold: true }, { text: " (https://policies.google.com/technologies/ads)." }] },
  { kind: 'h3', spans: [{ text: "Your choices about advertising" }] },
  { kind: 'li', spans: [{ text: "In the European Economic Area and the United Kingdom", bold: true }, { text: ", we ask for your consent before personalised ads are shown, using Google's User Messaging Platform. You can change your choice at any time from " }, { text: "Settings → Ad preferences", bold: true }, { text: " inside the game." }] },
  { kind: 'li', spans: [{ text: "On iOS", bold: true }, { text: ", the system asks separately for permission to track you across apps. If you decline, the game works exactly the same and you will still see ads — they will simply be less relevant." }] },
  { kind: 'li', spans: [{ text: "On Android", bold: true }, { text: ", you can reset or delete your Advertising ID in Settings → Privacy → Ads." }] },
  { kind: 'p', spans: [{ text: "Declining any of these never limits the game. Every feature, including rewarded ads, remains available." }] },
  { kind: 'h2', spans: [{ text: "Analytics" }] },
  { kind: 'p', spans: [{ text: "Pulse Blocks does not use any third-party analytics service. Gameplay events are written to a local development log only, and are not transmitted anywhere." }] },
  { kind: 'h2', spans: [{ text: "Payments" }] },
  { kind: 'p', spans: [{ text: "There are no in-app purchases and no subscriptions. The game never asks for payment details." }] },
  { kind: 'h2', spans: [{ text: "Children" }] },
  { kind: 'p', spans: [{ text: "Pulse Blocks is not directed at children under 13, and we do not knowingly collect personal information from them. Ad content is limited to a rating suitable for teens and above. If you believe a child has provided personal information, contact us at the address below and we will act on it." }] },
  { kind: 'h2', spans: [{ text: "Permissions" }] },
  { kind: 'p', spans: [{ text: "On Android the game requests only what it needs to function: internet access (to load ads), vibration (for haptic feedback) and audio settings (for sound effects). It does not request access to your microphone, camera, contacts, photos, files or location." }] },
  { kind: 'h2', spans: [{ text: "Changes to this policy" }] },
  { kind: 'p', spans: [{ text: "If this policy changes, the \"Last updated\" date above changes with it. The same text is shown inside the app and published at the privacy policy address listed on our store pages, so the two are always the same document." }] },
  { kind: 'h2', spans: [{ text: "Contact" }] },
  { kind: 'p', spans: [{ text: "Questions about this policy: " }, { text: "sagivhazut@gmail.com", bold: true }] },
];
