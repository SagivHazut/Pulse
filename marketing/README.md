# Marketing assets

Store screenshots and footage for Pulse Blocks. Everything here is **captured
output** — regenerate it rather than editing it by hand.

## What is here

```
screenshots/ios/       1320 x 2868   iPhone 17 Pro Max — the App Store 6.9" size
  01-home           title, coins, level, both modes, a run in progress
  02-gameplay       the board mid-run, tray loaded, Pulse meter nearly full
  03-themes         the theme ladder: five owned, the rest still locked
  04-daily          the seven-day cycle on day 6 of a live streak
  05-settings       level bar, audio and accessibility toggles, lifetime stats
  06-achievements   seven of ten unlocked
  07-block-styles   the four block finishes

screenshots/android/   1080 x 1920   Pixel-class emulator
  01-home  02-themes  03-daily  04-settings  05-gameplay

video/                 raw, unedited, no music
  ios-gameplay.mp4       33s   a run: line clear, combo, bomb power-up
  ios-themes.mp4         18s   scrolling the theme ladder into block styles
  ios-daily-reward.mp4    9s   opening the sheet and claiming day 6
  ios-settings.mp4       10s   the settings screen end to end
  android-gameplay.mp4   23s   the same run on Android
```

The clips are unedited on purpose — they are the source for an App Store app
preview (15–30s) or a generated ad, and the cut is better made downstream than
baked in here.

## The profile in these captures is fake, on purpose

A fresh install shows zeroes everywhere — no coins, an empty achievement grid,
one unlocked theme. That sells none of what the game is, and playing far enough
to unlock the theme ladder honestly takes roughly 150 runs.

So these are captured with `expo.extra.demoSeed` enabled, which writes a
believable mid-ladder profile (`src/services/storage/demoSeed.ts`): level 11,
2,840 coins, five of eight themes, seven of ten achievements, a 48k best, and a
run already in progress.

It is deliberately **not** a maxed-out account. Screenshots showing everything
unlocked and a seven-figure score read as fake, and they misrepresent the economy
to someone deciding whether to install.

`demoSeed` is gated on `__DEV__`, like `forceTestUnits` and `forceEeaConsent`, so
it cannot run in a release build or touch a real player's save.

### The board is composed, and the composition is tested

The seeded board is authored as ASCII in `demoFixture.ts`, which means it can be
wrong in ways that are invisible while editing and obvious in a screenshot. Two
rules are asserted rather than trusted, and both have already caught a mistake:

- **No row or column may be complete.** A full line clears the instant it forms,
  so a board containing one is a state the engine could never produce.
- **A tray piece must be able to clear a line**, and specifically the domino must
  fit the gap in row 5 that it is drawn for. The first version paired a two-wide
  piece with a one-cell gap — the shot advertised a payoff that could not be
  taken.

`src/services/storage/__tests__/demoFixture.test.ts` covers both, including the
exact board that was wrong.

## Regenerating

```bash
# 1. turn the seed on: app.json -> expo.extra.demoSeed = true
npx expo run:ios --device "iPhone 17 Pro Max"     # 6.9" captures
npx expo run:android
```

Give both platforms a clean status bar first — 9:41, full battery, full signal,
no notifications — or every shot is stamped with the wall clock of whenever it
was taken:

```bash
# iOS
xcrun simctl status_bar <udid> override --time "9:41" --batteryState charged \
  --batteryLevel 100 --wifiBars 3 --cellularBars 4

# Android
adb shell settings put global sysui_demo_allowed 1
adb shell am broadcast -a com.android.systemui.demo -e command enter
adb shell am broadcast -a com.android.systemui.demo -e command clock -e hhmm 0941
adb shell am broadcast -a com.android.systemui.demo -e command battery -e level 100 -e plugged false
adb shell am broadcast -a com.android.systemui.demo -e command network -e wifi show -e level 4
```

Then capture:

```bash
xcrun simctl io <udid> screenshot out.png
xcrun simctl io <udid> recordVideo --codec h264 out.mp4    # ctrl-C to stop
adb exec-out screencap -p > out.png
adb shell screenrecord --size 1080x1920 --bit-rate 8000000 /sdcard/out.mp4
adb pull /sdcard/out.mp4
```

`adb shell pm clear com.pulseblocks.game` between takes — the seed reapplies on
the next launch, and it is the only way to be sure a screenshot is not carrying
state from the previous one.

Finally: **set `expo.extra.demoSeed` back to `false`** and rebuild. The flag is
read from the app config embedded in the binary at build time, so flipping it
without a rebuild changes nothing — a Metro reload will not do it.

`npm run preflight` does not check the flag, because it cannot reach a release
build: `demoSeedEnabled()` requires `__DEV__` as well. What it can do is quietly
overwrite your own save on every launch of a dev build, which is the reason to
turn it off rather than leave it.

## Store requirements

| Store | Needs |
| --- | --- |
| App Store | 6.9" (1320x2868) and 6.5" (1242x2688), up to 10 each |
| Play Store | min 2 phone shots, 1080p+; feature graphic **1024x500**; optional 30s–2min trailer |

The 6.5" set and the Play feature graphic are still missing. The 6.5" shots need
their own capture pass on an iPhone 11 Pro Max-class simulator — App Store
Connect will not accept a downscale of the 6.9" images.
