# Pulse Blocks

A block-placement puzzle game for iOS and Android. Drag three pieces at a time onto an 8×8 grid, complete rows and columns to clear them, and chain clears across turns to build a **Pulse combo**. Offline-first, no backend, no account.

Built with Expo (SDK 57) · React Native 0.86 · TypeScript · Reanimated 4 · Gesture Handler · Zustand.

---

## Quick start

```bash
npm install
npm start
```

Then press `i` for the iOS simulator, `a` for Android, or `w` for the browser. Everything except MMKV and the real ad SDK runs in Expo Go.

| Command | What it does |
| --- | --- |
| `npm start` | Expo dev server |
| `npm run ios` / `npm run android` / `npm run web` | Start on a specific platform |
| `npm test` | Jest unit tests (156 tests, engine + persistence + drag math + economy + modes + ad pacing) |
| `npm run test:coverage` | Tests with a coverage report |
| `npm run typecheck` | `tsc --noEmit`, strict mode |
| `npm run lint` | ESLint (expo config + React Compiler rules) |
| `npm run audio` | Regenerate every sound file from source |
| `npm run prebuild:clean` | Regenerate `ios/` and `android/` |

---

## Two modes

Both share the board, the combo system, scoring, the difficulty ramp, the near-fail tension, the rewarded revive and every cosmetic. They differ only in the power systems.

| | Classic | Pulse |
| --- | --- | --- |
| Power tiles in pieces | — | ✓ |
| Bomb / Bolt / Refresh toolbar | — | ✓ |
| Pulse meter and its free power-up | — | ✓ |
| Combos, scoring, revive, themes | ✓ | ✓ |

Classic is the same game with the power systems switched off, not a cut-down one. It keeps combos, because those are core scoring rather than a power — it just shows a slim combo readout where Pulse shows the meter.

Every difference is declared as capability flags in [`game/modes.ts`](src/game/modes.ts), so the generator, the store and the UI branch on `powerTiles` / `powerUps` / `pulseMeter` rather than on `mode === 'classic'` checks scattered about. Adding a third mode means adding an entry.

**High scores are kept per mode.** Powers inflate scores, so a single table would put Classic at a permanent disadvantage. The mode picker on Home shows each mode's own record. Saves written before modes existed carry one `highScore` earned with powers on, so it migrates to Pulse — covered by a test.

---

## How the game works

**The loop.** Three pieces at a time. Place them anywhere they fit. A full row or column clears. When all three are used, three more arrive. The run ends when none of the pieces in hand fit anywhere.

**Pulse combo.** Clearing on consecutive turns raises a combo multiplier. Miss for more than two turns and it resets. The presentation escalates with it — bigger type, stronger haptics, rising sound pitch, screen shake, and a full-screen flash at ×10.

**Pulse meter.** Clears charge a meter. Filling it awards a free power-up.

**Power blocks.** Uncommon tiles baked into pieces:

| Tile | Effect |
| --- | --- |
| ✸ Bomb | Destroys the surrounding 3×3 when caught in a clear |
| ⚡ Lightning | Clears its entire row and column |
| ◆ Rainbow | Wildcard — the only tile that may be dropped on an occupied cell |
| ❄ Freeze | Buys one extra turn of grace before the combo drops |
| ◉ Pulse | Fills the Pulse meter instantly |

Bombs and lightning **cascade**: anything they destroy can trigger in turn.

**Power-ups.** A separate consumable inventory (Bomb, Bolt, Refresh) shown in the bottom toolbar, earned from the Pulse meter or an optional rewarded ad.

**Fairness.** While the board is below 85% full, the generator guarantees at least one piece of each hand fits somewhere. Above that the guarantee is dropped — but pieces are **never** manipulated to force a loss. Difficulty comes from the board, not from the dealer.

---

## Architecture

```text
src/
  game/            pure game rules — no React, no React Native
    engine/        board, placement, line detection, clears, turn resolution, revive
    pieces/        shape definitions (authored as ASCII)
    generators/    piece generation, fairness and difficulty ramp
    scoring/       score, combo multipliers, coins
    powerups/      power-up inventory and effects
    dragMath.ts    drag geometry + validity, shared with the gesture worklet
  services/        side-effecting adapters
    ads/           AdService interface, mock provider, AdMob adapter
    audio/         sound effects and two-layer adaptive music
    haptics/       one place where the haptics toggle is honoured
    storage/       MMKV → AsyncStorage → memory, plus schema validation
    analytics/     provider-agnostic event tracking
  stores/          Zustand: game, player, settings, monetization, router, ui
  components/      game/, ui/, animations/
  screens/         Splash, Home, Game, GameOver, Themes, Settings, Tutorial, DailyReward
  theme/           theme registry and design tokens
  utils/           seeded RNG, responsive board layout
```

**The rule that shapes everything:** `src/game/**` and `src/services/storage/schema.ts` import nothing from React or React Native. That is what makes the rules testable on plain Node in ~2 seconds, and it is worth preserving.

### Rendering and performance

- **Drag never touches React state.** The airborne piece is driven entirely by Reanimated shared values on the UI thread. The JS thread is only notified when the *snapped target cell changes* — a few times per second, not 60.
- **Validity runs in a worklet** against a flat `0/1` mirror of the board, using the same `canPlaceOnGrid` the tests exercise. `dragMath.test.ts` asserts the worklet and the engine agree at every position for every shape, so a preview can never promise a placement the engine will reject.
- **The dragged piece lives in a root-level layer** (`DragLayer`), not in the tray, so it cannot be clipped by a parent — a real problem on Android — and always paints above the board.
- **Cells are individually memoised** on identity. Placing a piece re-renders the handful of cells that changed, not the grid.
- **Entrance animations are plain animated styles**, not Reanimated layout animations. A layout animation that fails to run leaves a container at opacity 0 — a blank screen instead of a missing flourish.

---

## Audio

The game ships **no sampled or licensed audio**. Every sound is synthesised from oscillators and filtered noise by `scripts/generate-audio.js`:

```bash
npm run audio    # writes assets/audio/*.wav
```

14 effects plus two music loops (`music_base`, `music_tension`) that play in sync. Board pressure crossfades between them, so tension rises without the track ever restarting. Everything sits in one pentatonic scale, so layered sounds never clash.

To change the palette, edit the generator and re-run it — the sounds are code, not binaries to hunt down.

---

## Storage

Three backends, chosen at boot, transparent to everything above:

1. **MMKV** — used whenever the native module is present.
2. **AsyncStorage + in-memory mirror** — Expo Go and web. Hydrated once at boot so reads stay synchronous.
3. **Memory only** — last resort, so a broken storage layer costs the session, not the app.

Which one is live is shown at the bottom of the Settings screen.

Everything read back from disk goes through `schema.ts`, which validates and repairs defensively. A corrupt save never crashes the game, and a readable high score survives an otherwise unreadable record. A mid-run snapshot is written after every settled turn, so closing the app offers **CONTINUE GAME** rather than losing the board.

### Banking a run exactly once

A run is credited to the profile the moment it ends, so a force-quit can never cost the player their score. But a rewarded revive *resumes that same run*, so the run ends — and is banked — more than once. `game/runBanking.ts` reconciles each commit against what was already paid, computing coins and XP as "total earned minus total already credited" rather than from raw deltas, so the non-linear parts of both formulas settle exactly. Without it, reviving would double coins, XP, lines cleared and games played — and would be farmable.

---

## Cosmetics and the coin economy

Coins buy appearance and nothing else — there is no way to spend them on an advantage, and no way to buy them with money. Two independent axes multiply out:

**Themes** (8) recolour everything: background, board, blocks, particles and UI accent.

| Theme | Price | Level |
| --- | --- | --- |
| Neon | free | 1 |
| Ocean | 400 | 3 |
| Candy | 900 | 6 |
| Galaxy | 1,400 | 8 |
| Ember | 1,800 | 10 |
| Ice | 2,200 | 12 |
| Retro | 2,600 | 14 |
| Mono | 3,000 | 16 |

**Block finishes** (4) change how a tile is *built* rather than its colour — the lip, the highlight, the corner radius, whether it is solid at all: Gloss (free), Flat (600), Bevel (1,000), Outline (1,600).

8 × 4 means 32 distinct-looking boards from twelve definitions, and finishes give coins somewhere to go after the theme ladder.

### Pacing

Earn rates are tuned against the ladder rather than picked by feel, and `pacing.test.ts` asserts the result. Measured against a "decent run" (5,000 points, 18 lines, best combo 6 — worth 190 XP and 83 coins):

- first paid theme: ~5 runs
- halfway (Ember): ~55 runs
- everything: ~150 runs, before daily rewards and achievements

The test also enforces the intended relationship: **level gates always land before the coins are affordable**, so levels prevent buying the catalogue on day one but coins are the actual price. An earlier version of this ladder needed ~300 runs for the last theme; the test exists so that cannot come back unnoticed.

---

## Ad configuration

Ads sit behind one interface (`src/services/ads/AdService.ts`) and no screen imports a provider directly.

- **`MockAdService`** — the development stand-in, used when the native SDK is unavailable (Expo Go, web). It presents a **visible placeholder** — a full-screen "TEST AD" panel with a countdown, a *collect* button once the timer ends, and a *close early* button that earns nothing — so the rewarded flow looks and behaves like the real thing and both outcomes can be tested deliberately. It also fails to fill 5% of the time, keeping the "ad unavailable" path exercised.
- **`AdMobAdService`** — a complete Google AdMob adapter, active as soon as the SDK is installed.
- **`NullAdService`** — the release-build fallback. If the real SDK cannot start in production, every format reports unavailable: rewarded offers hide themselves rather than showing a placeholder or granting a reward no advertiser paid for. The mock is `__DEV__`-only by construction.

Both live placements are bounded by a timeout (120s rewarded, 60s interstitial). A presentation that never resolves would otherwise leave the offering button permanently disabled with no way back — reachable from a hung SDK callback, and routine in development when Fast Refresh swaps the provider mid-ad.

### Going live with real ads

Ads run through the mock provider until the SDK is installed, so the game is fully playable and testable today. Switching to real ads is five steps, in this order.

**1 — AdMob account setup** (nothing to do in code)

Create an app in the AdMob console for each platform, then create the ad units:

| Ad unit | Format |
| --- | --- |
| Revive / Double coins / Rescue / Daily doubler | **Rewarded** (one unit serves all four) |
| Between-runs | **Interstitial** |

Note the **App ID** (`ca-app-pub-…~…`, with a tilde) and each **unit ID** (`ca-app-pub-…/…`, with a slash) — they are different things and mixing them up is the most common setup failure.

**Verifying the integration before your account can serve ads**

A new AdMob account returns `no-fill — Publisher data not found` for its own live
units until the account is complete (payments/address submitted) and the app has
propagated. That is indistinguishable from a broken integration, so there is a
switch for it:

```json
"extra": { "admob": { "forceTestUnits": true } }
```

Every format then uses Google's test inventory, which always fills. It is honoured
only in development — a release build ignores it, because the flag is gated on the
same `__DEV__` check as the test-unit fallback. **It is read at build time**, so
change it and rebuild (`npx expo run:ios`); restarting Metro is not enough, since
`expo-constants` embeds the config into the app bundle.

Development builds also register as test devices (`testDeviceIdentifiers:
['EMULATOR']`) before the SDK initialises, so requests against *live* unit IDs
return test creatives and are never billed. Clicking a genuinely live ad in your
own app is the most common cause of an AdMob suspension; add physical test devices
in the console before tapping anything on hardware.

Dev builds log the resolved unit ids and Google's own load errors
(`[ads] rewarded load error …`). Reach for those first — "ad unavailable" alone
cannot distinguish no-fill from a wrong unit id from an unapproved app.

**Version pin: `react-native-google-mobile-ads` is fixed at 16.3.4 — do not bump it blindly**

16.4.0 pins `play-services-ads:25.4.0`, whose Kotlin metadata is 2.3.0. React
Native 0.86 compiles with Kotlin 2.1.20, which reads metadata only up to 2.2.0, so
**the Android build fails outright** — the ads module will not compile. Neither
obvious workaround helps:

- Raising `kotlinVersion` through expo-build-properties moves the *stdlib* but not
  the *compiler* (React Native pins the Kotlin Gradle Plugin in its own version
  catalog), which then breaks unrelated modules that were building fine.
- Forcing an older `play-services-ads` under 16.4.0 fails too: 25.0.0 and below
  lack `AgeRestrictedTreatment`, which the library calls.

16.3.4 is the newest release whose pinned SDK (25.0.0) both compiles and satisfies
the library. The dependency is written without a caret so `npm install` cannot
drift back onto 16.4.0. Revisit only when React Native ships Kotlin >= 2.3.

**Testing ads on an Android emulator**

Use a **`google_apis_playstore`** system image. The plain `google_apis` image has no
Play Store and therefore no advertising ID, and Google returns `No fill` for every
request — including its own test units, which otherwise always fill. That looks
exactly like a broken integration.

**macOS: CocoaPods needs a UTF-8 locale**

`pod install` aborts with `Unicode Normalization not appropriate for ASCII-8BIT`
when `LANG` is unset (common in CI and non-interactive shells). Export
`LANG=en_US.UTF-8` before building iOS.

**2 — Install the SDK**

```bash
npx expo install react-native-google-mobile-ads expo-tracking-transparency
```

`expo-tracking-transparency` is what shows the iOS ATT prompt. Both are listed as optional modules in `metro.config.js`, so the bundle keeps building for anyone who has not installed them.

**3 — Configure `app.json`**

App IDs go in the plugin; unit IDs go in `extra`. The plugin's `androidAppId` is
not optional — it writes the manifest meta-data the native SDK reads at startup,
and **the SDK crashes on launch without it**. `expo run:android` warns about this
on every start, which is easy to scroll past.

```json
{
  "expo": {
    "plugins": [
      "expo-audio",
      ["react-native-google-mobile-ads", {
        "androidAppId": "ca-app-pub-xxx~xxx",
        "iosAppId": "ca-app-pub-xxx~xxx",
        "userTrackingUsageDescription": "This identifier is used to show you more relevant ads. You can play the whole game without allowing it."
      }]
    ],
    "extra": {
      "admob": {
        "iosRewardedUnitId": "ca-app-pub-xxx/xxx",
        "iosInterstitialUnitId": "ca-app-pub-xxx/xxx",
        "androidRewardedUnitId": "ca-app-pub-xxx/xxx",
        "androidInterstitialUnitId": "ca-app-pub-xxx/xxx"
      }
    }
  }
}
```

Unit IDs are read from config, not source — going live is a config change and a rebuild, never a code edit that could be left on a branch. Any blank falls back to Google's test unit, and the Settings screen shows `ads: admob (test units)` whenever that is happening, so a half-configured build is visible rather than silent.

**4 — Build a dev client and verify**

Ads cannot run in Expo Go — they need a native build:

```bash
npx expo prebuild --clean
npx expo run:ios        # or: npx expo run:android
```

Check, in this order:

- Settings shows `ads: admob` with no `(test units)`
- the first rewarded offer shows the consent form, then the ATT prompt (iOS)
- closing a rewarded ad early grants **nothing**
- watching to completion grants exactly once
- aeroplane mode: the offer says "Ad unavailable", and gameplay is untouched

Register your device as a **test device** in the AdMob console first. Clicking your own live ads risks the account.

**5 — Consent, before you ship**

`services/ads/consent.ts` wires up Google's User Messaging Platform and iOS ATT. You still have to create the **privacy message** in the AdMob console (Privacy & messaging → GDPR + a US-states message) or the form has nothing to show.

Two behaviours worth knowing, both deliberate:

- **Nothing is prompted at launch.** Consent is gathered the first time a rewarded ad is actually offered — a moment the player initiated. The brief asks for this explicitly, and it converts far better than a cold prompt on first open.
- **Interstitials never trigger the form.** They are not player-initiated, so an interstitial before consent has been gathered is simply skipped rather than prompting between runs.

Until consent is granted, ads are requested **non-personalised**. That is read per request rather than captured once, so revoking consent takes effect immediately.

**Also required:** host an `app-ads.txt` at the domain in your store listing, containing the line AdMob gives you. Without it your inventory is treated as unauthorised and fill rates collapse.

### The revenue model

**Ads only — no in-app purchases.** That is a deliberate choice while the game is
looking for an audience: payment plumbing is worth building once there are players
to sell to, not before.

It has one consequence worth stating plainly: a churned player earns nothing at
all, so retention *is* the revenue strategy. Everything below follows from that.

- **Rewarded ads carry the income.** Four placements, all opt-in, all at moments
  the player already wants something: revive, double coins, a free power-up, and
  the daily doubler. Revives are capped at 2 per run — the main rewarded lever.
- **Interstitials are kept deliberately rare.** They are the only ad the player
  does not choose, so they are the only one that can cost retention. Nothing is
  shown for the first 5 completed games, then roughly every 3–5 games with a
  3-minute cooldown.
- **Opening the app shows nothing.** There is no app-open ad format. Launching,
  browsing menus, changing themes and quitting are all ad-free.
- **Coins are earned, never sold.** They buy cosmetics and power-ups, so selling
  them would be selling a gameplay advantage. Keeping them earn-only is what makes
  the power-up shop fair.

If IAP is added later, the conventional shape is a one-off "remove ads" that
suppresses interstitials while leaving rewarded ads available — the players who
buy it still want the revive.

### Placement rules (all enforced in `useMonetizationStore`)

| Placement | Rule |
| --- | --- |
| Rewarded revive | Opt-in only, `MAX_REVIVES_PER_RUN = 1` |
| Double coins | Offered once after a run, opt-in |
| Rescue power-up | Once per app session, only when the toolbar is empty |
| Daily reward doubler | Opt-in |
| Interstitial | Never in the first 2 games, then every 3–5 games, with a 3-minute cooldown |

Interstitials never appear during gameplay, during a drag, during an animation, immediately after a rewarded ad, or during onboarding.

### Reward integrity

`earned` is set **only** from the provider's own completion callback — closing an ad early resolves as `dismissed`, never as earned. Rewards are granted inside an idempotency guard keyed to the ad presentation, so a duplicate callback cannot pay out twice. The run is banked by the store the moment it ends, before any ad is offered, so no ad outcome can cost a player their score.

---

## Analytics

`services/analytics` is a provider registry with a dev-console sink. Adding Firebase is one adapter and one `registerAnalyticsProvider` call at boot — no call site changes. A commented example adapter is in the file.

Tracked: `app_open`, `game_started`, `game_finished`, `game_resumed`, `line_clear`, `combo_level`, `power_block_triggered`, `power_up_used`, `near_fail`, the full rewarded-ad funnel, `revive_used`, `interstitial_shown`, `daily_reward`, `theme_unlocked`, `achievement_unlocked`, `level_up`, `tutorial_started/completed`, `settings_changed`.

---

## Testing

```bash
npm test
```

156 tests on plain Node via ts-jest — no native runtime, no Metro transform:

- placement, bounds, overlap, and the rainbow wildcard
- line detection, multi-line clears, power cascades, perfect clears
- combo growth, grace window, freeze charges, Pulse meter
- scoring and coin conversion
- piece generation: determinism, fairness guarantee, power-block caps, difficulty ramp
- revive ratio and that it reopens genuinely playable space
- persistence: corrupt saves, wrong board sizes, version mismatches, out-of-range values
- drag math, verified against geometry measured from the running app, and asserted to agree with the engine at every position
- run banking: a revived run is credited exactly once, no matter how many times it ends
- economy pacing: the ladder stays reachable and coins stay the binding constraint
- modes: Classic deals no power tile at any seed or round, while Pulse still does
- ad pacing: grace period, randomised gap, cooldown boundaries, and "never shown" handling
- power-up pricing: bundle discounts, monotonic pricing, and sane cost against the earn rate
- the pre-modes save migration (a single `highScore` becomes the Pulse record)

**Not covered by tests:** the live gesture itself. The coordinate math and validity logic it depends on are tested, but the touch interaction needs a device or simulator — see below.

---

## Verification status

Played end to end on the iOS simulator (iPhone 17, iOS 26.4) with real touch input. Confirmed working:

- dragging, ghost preview, drop snapping, completing-line highlight
- combo chain 1 → 6, including a simultaneous double-line clear
- Pulse meter charging and paying out a free power-up
- Freeze tiles landing on the board; Bomb power-up targeting and clearing
- game over → achievements → **rewarded revive** (14 cells cleared) → "BACK IN!"
- **double coins** and **rescue power-up** rewarded ads, both completing and paying out
- coins, high score and achievements banked and reflected in the HUD

Also verified in a browser build: persistence round-trip, reduced motion, theme rendering and level gating, accessibility labels (every control is a real labelled button), storage fallback selection.

**Still unverified:** haptics, which need a physical device — the simulator has no haptic engine.

---

## Accessibility

Reduced motion (removes shakes, particles, drifting backgrounds), independent sound / music / haptics toggles, 44pt minimum tap targets, live-region score and toasts, labelled controls throughout. Validity is never signalled by colour alone: an invalid placement gets a dashed border and an ✕ glyph as well as a red tint.

---

## Release checklist

Ordered by what blocks what. Everything in **Code** is done; the rest needs your accounts and assets.

**Code — done**

- [x] engine, modes, economy, cosmetics, persistence, audio, analytics
- [x] ad abstraction with mock + AdMob providers and reward-integrity guards
- [x] ad frequency caps, cooldowns and the new-player grace period
- [x] UMP consent + ATT plumbing, deferred to the first ad rather than launch
- [x] unit IDs read from app config, with a visible warning on test units
- [x] 143 tests, strict typecheck, clean lint

**Yours — identity and legal**

- [ ] replace `com.example.pulseblocks` in `app.json` with your real bundle ID and package name
- [ ] replace the placeholder URLs in `src/constants/app.ts` with a live privacy policy and terms
- [ ] replace the placeholder icons and splash art in `assets/`
- [ ] host `app-ads.txt` on the domain in your store listing

**Yours — ads**

- [ ] AdMob app + rewarded + interstitial units created, IDs in `app.json`
- [ ] privacy message created in AdMob (GDPR + US states)
- [ ] test devices registered, then verify the five checks above on a dev build

**Yours — store submission**

- [ ] Apple: complete App Privacy (you collect an advertising identifier and usage data) and include a privacy manifest for the SDK
- [ ] Google: complete the Data safety form; declare the advertising ID permission
- [ ] both: age rating questionnaires — declare that the app contains ads
- [ ] screenshots and description

**Then**

```bash
npm run typecheck && npm run lint && npm test
npx expo prebuild --clean
eas build --platform all --profile production
```

**Not done, and worth knowing:** haptics are unverified on hardware (a simulator has no haptic engine), and there is no crash reporting. The analytics layer takes a provider in one line, so Sentry or Crashlytics is a small addition — but shipping without any crash visibility is a real gap.

---

## Tuning

Almost every number worth changing lives in `src/constants/config.ts`: grid size, scoring weights, combo thresholds, power-block rates, generator fairness, revive ratio, ad pacing, daily rewards, XP curve, animation timings. The engine reads dimensions from the board it is given, so changing `GAME_CONFIG.rows/columns` changes the game — no other edits required.

---

## Not built (deliberately)

Leaderboards, cloud save, challenges, events, multiplayer, season pass, remove-ads IAP. The architecture leaves room for all of them — the store boundaries and the ad/analytics interfaces are the seams — but none is in this build.
# Pulse
