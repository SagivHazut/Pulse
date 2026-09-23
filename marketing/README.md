# Marketing assets

Store screenshots and footage for Pulse Blocks. Everything here is **captured
output** — regenerate it rather than editing it by hand.

## What is here

```
screenshots/ios/       1320 x 2868  (6.9", iPhone 17 Pro Max)
screenshots/android/   1080 x 2400  (Pixel-class emulator)
video/                 raw simulator recordings, .mp4
```

## The profile in these captures is fake, on purpose

A fresh install shows zeroes everywhere — no coins, an empty achievement grid,
one unlocked theme. That sells none of what the game is, and playing far enough
to unlock the theme ladder honestly takes roughly 150 runs.

So these are captured with `expo.extra.demoSeed` enabled, which writes a
believable mid-ladder profile (see `src/services/storage/demoSeed.ts`): level 11,
2,840 coins, five of eight themes, seven of ten achievements, a 48k best.

It is deliberately **not** a maxed-out account. Screenshots showing everything
unlocked and a seven-figure score read as fake, and they misrepresent the economy
to someone deciding whether to install.

`demoSeed` is gated on `__DEV__`, like `forceTestUnits` and `forceEeaConsent`, so
it cannot run in a release build or touch a real player's save.

## Regenerating

```bash
# 1. turn the seed on
#    app.json -> expo.extra.demoSeed = true
npx expo run:ios --device "iPhone 17 Pro Max"     # 6.9" captures
npx expo run:android                              # Android captures

# 2. capture
xcrun simctl io <udid> screenshot out.png
xcrun simctl io <udid> recordVideo out.mp4        # ctrl-C to stop
adb exec-out screencap -p > out.png
adb shell screenrecord /sdcard/out.mp4            # ctrl-C, then adb pull

# 3. turn it back off before building a release
#    app.json -> expo.extra.demoSeed = false
```

## Store requirements

| Store | Needs |
| --- | --- |
| App Store | 6.9" (1320x2868) and 6.5" (1242x2688), up to 10 each |
| Play Store | min 2 phone shots, 1080p+; feature graphic **1024x500**; optional 30s-2min trailer |

The App Store also accepts app previews (15–30s, same resolution as the
screenshots). The raw clips in `video/` are the source for those and for any
generated ad — they are unedited on purpose, so the cut can be made downstream.

## Before shipping

Set `expo.extra.demoSeed` back to `false`. `npm run preflight` does not check it,
because it cannot affect a release build — but a dev build with a seeded profile
will quietly overwrite your own save every launch.
