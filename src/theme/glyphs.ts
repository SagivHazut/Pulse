/**
 * Icon glyphs used by the chrome.
 *
 * Two rules, both learned the hard way on device:
 *
 *  - Avoid characters with an emoji presentation. iOS renders U+2699 GEAR as a
 *    colour emoji, which ignores the tint colour and clashes with the flat UI, so
 *    it is pinned to text presentation with a VS15 selector (U+FE0E).
 *  - Prefer glyphs that are well-drawn at small sizes. U+2302 HOUSE renders as a
 *    thin, top-heavy outline that reads as broken; a plain arrow is cleaner and
 *    matches the back buttons on the other screens.
 */
export const GLYPH = {
  /** Leave the current screen. Matches the back affordance elsewhere. */
  back: '\u2190',
  settings: '\u2699\uFE0E',
  daily: '\u25C8',
  themes: '\u25D0',
} as const;
