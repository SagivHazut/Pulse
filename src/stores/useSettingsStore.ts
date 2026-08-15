import { create } from 'zustand';

import { track } from '../services/analytics';
import { setMusicEnabled, setSoundEnabled } from '../services/audio';
import { setHapticsEnabled } from '../services/haptics';
import { getPlayerData, patchPlayerData } from '../services/storage/playerData';

type SettingsState = {
  soundEnabled: boolean;
  musicEnabled: boolean;
  hapticsEnabled: boolean;
  reducedMotion: boolean;

  hydrate(): void;
  setSound(value: boolean): void;
  setMusic(value: boolean): void;
  setHaptics(value: boolean): void;
  setReducedMotion(value: boolean): void;
};

export const useSettingsStore = create<SettingsState>((set) => ({
  soundEnabled: true,
  musicEnabled: true,
  hapticsEnabled: true,
  reducedMotion: false,

  hydrate() {
    const data = getPlayerData();
    setSoundEnabled(data.soundEnabled);
    setMusicEnabled(data.musicEnabled);
    setHapticsEnabled(data.hapticsEnabled);
    set({
      soundEnabled: data.soundEnabled,
      musicEnabled: data.musicEnabled,
      hapticsEnabled: data.hapticsEnabled,
      reducedMotion: data.reducedMotion,
    });
  },

  setSound(value) {
    setSoundEnabled(value);
    patchPlayerData({ soundEnabled: value });
    track('settings_changed', { setting: 'sound', value });
    set({ soundEnabled: value });
  },

  setMusic(value) {
    setMusicEnabled(value);
    patchPlayerData({ musicEnabled: value });
    track('settings_changed', { setting: 'music', value });
    set({ musicEnabled: value });
  },

  setHaptics(value) {
    setHapticsEnabled(value);
    patchPlayerData({ hapticsEnabled: value });
    track('settings_changed', { setting: 'haptics', value });
    set({ hapticsEnabled: value });
  },

  setReducedMotion(value) {
    patchPlayerData({ reducedMotion: value });
    track('settings_changed', { setting: 'reduced_motion', value });
    set({ reducedMotion: value });
  },
}));

/** Read reduced-motion outside React (animation helpers, worklet setup). */
export function isReducedMotion(): boolean {
  return useSettingsStore.getState().reducedMotion;
}
