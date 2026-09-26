/**
 * Icon glyphs used by the chrome.
 *
 * Two rules, both learned the hard way on device:
 *
 *  - Avoid characters with an emoji presentation. iOS renders U+2699 GEAR as a
 *    colour emoji, which ignores the tint colour and clashes with the flat UI, so
 *    it is pinned to text presentation with a VS15 selector (U+FE0E).
 *  - Prefer glyphs that are well-drawn at small sizes. U+2302 HOUSE renders as a
 *    thin, top-heavy outline that reads as broken.
 *
 * The back arrow used to live here as U+2190 and no longer does: measured in the
 * same 42dp button, SF drew it 10.0dp tall and centred while Roboto drew it
 * 4.2dp tall and 3.2dp below centre. It is {@link BackArrow} now — drawn, not
 * typed. The glyphs that remain were measured too, and behave: U+2699 comes out
 * 14.5dp on Android against 9.7dp on iOS, both centred.
 */
export const GLYPH = {
  settings: '\u2699\uFE0E',
  daily: '\u25C8',
  themes: '\u25D0',
} as const;
