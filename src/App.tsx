import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  BackHandler,
  Platform,
  StyleSheet,
  View,
  type AppStateStatus,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { MockAdOverlay } from './components/ads/MockAdOverlay';
import { Toast } from './components/ui/Toast';
import { useTheme } from './hooks/useTheme';
import { initAds } from './services/ads';
import {
  consoleAnalyticsProvider,
  registerAnalyticsProvider,
  track,
} from './services/analytics';
import { initAudio, startMusic, stopMusic } from './services/audio';
import { setHapticsEnabled } from './services/haptics';
import { hydrateStorage } from './services/storage';
import { getPlayerData } from './services/storage/playerData';
import { GameScreen } from './screens/GameScreen';
import { HomeScreen } from './screens/HomeScreen';
import { PrivacyScreen } from './screens/PrivacyScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { SplashScreen } from './screens/SplashScreen';
import { ThemesScreen } from './screens/ThemesScreen';
import { useGameStore } from './stores/useGameStore';
import { useMonetizationStore } from './stores/useMonetizationStore';
import { usePlayerStore } from './stores/usePlayerStore';
import { useRouterStore } from './stores/useRouterStore';
import { useSettingsStore } from './stores/useSettingsStore';
import { useUiStore } from './stores/useUiStore';

/**
 * App root.
 *
 * Boot order matters: storage first (everything else reads the player record),
 * then audio and haptics with the player's saved toggles, then ads — which are
 * fire-and-forget, because the game must be fully playable offline and an ad SDK
 * that never initialises should cost nobody a frame.
 */
export default function App() {
  const [ready, setReady] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  /**
   * Stable, so the splash's minimum-duration timer is armed once at mount. An
   * inline arrow changed identity when boot finished, which tore the timer down
   * and started a fresh one — making the splash last boot time *plus* its
   * minimum, instead of overlapping it as intended.
   */
  const handleSplashDone = useCallback(() => setSplashDone(true), []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await hydrateStorage();
      } catch {
        // Storage is optional; the game runs from memory if it fails.
      }
      if (cancelled) return;

      const data = getPlayerData();

      usePlayerStore.getState().hydrate();
      useSettingsStore.getState().hydrate();
      useMonetizationStore.getState().hydrate();
      setHapticsEnabled(data.hapticsEnabled);

      registerAnalyticsProvider(consoleAnalyticsProvider);
      track('app_open', {
        high_score_classic: data.highScores.classic,
        high_score_pulse: data.highScores.pulse,
        games: data.totalGames,
      });

      try {
        await initAudio({
          soundEnabled: data.soundEnabled,
          musicEnabled: data.musicEnabled,
        });
        startMusic();
      } catch {
        // Audio is a nicety, never a blocker.
      }

      // Deliberately not awaited: ads must never delay first paint.
      void initAds();

      if (!cancelled) setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready || !splashDone) {
    return (
      <SafeAreaProvider>
        <GestureHandlerRootView style={styles.root}>
          <ThemedStatusBar />
          <SplashScreen onDone={handleSplashDone} />
        </GestureHandlerRootView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={styles.root}>
        <ThemedStatusBar />
        <RootNavigator />
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

function ThemedStatusBar() {
  const theme = useTheme();
  return <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />;
}

function RootNavigator() {
  const route = useRouterStore((s) => s.route);
  const go = useRouterStore((s) => s.go);
  const toast = useUiStore((s) => s.toast);
  const dismissToast = useUiStore((s) => s.dismissToast);
  const theme = useTheme();

  const persist = useGameStore((s) => s.persist);
  const status = useGameStore((s) => s.status);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  // Splash hands off to home; the router starts on 'splash' so nothing flashes.
  useEffect(() => {
    if (route === 'splash') go('home');
  }, [route, go]);

  /** Snapshot the run and pause music whenever the app leaves the foreground. */
  const handleAppState = useCallback(
    (next: AppStateStatus) => {
      const wasActive = appState.current === 'active';
      appState.current = next;

      if (wasActive && next.match(/inactive|background/)) {
        if (status === 'playing') persist();
        stopMusic();
      } else if (!wasActive && next === 'active') {
        startMusic();
      }
    },
    [persist, status],
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  }, [handleAppState]);

  /**
   * Android hardware / gesture back.
   *
   * This app uses a tiny custom router rather than React Navigation, so nothing
   * handles the system back button for free — without this, pressing back
   * anywhere would close the app outright, including mid-run. Returning to Home
   * is safe from any screen: the run is snapshotted after every settled turn, so
   * it is offered again as CONTINUE rather than lost.
   *
   * From Home we return false and let the OS close the app, which is the
   * behaviour Android users expect.
   */
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (useRouterStore.getState().route === 'home') return false;
      if (useGameStore.getState().status === 'playing') useGameStore.getState().persist();
      go('home');
      return true;
    });
    return () => sub.remove();
  }, [go]);

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      {route === 'game' ? (
        <GameScreen />
      ) : route === 'themes' ? (
        <ThemesScreen />
      ) : route === 'settings' ? (
        <SettingsScreen />
      ) : route === 'privacy' ? (
        <PrivacyScreen />
      ) : (
        <HomeScreen />
      )}

      <Toast message={toast} onDismiss={dismissToast} />
      {/* Renders only when the mock provider presents an ad — never in release. */}
      <MockAdOverlay />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
