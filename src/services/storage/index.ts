import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, TurboModuleRegistry } from 'react-native';

/**
 * Synchronous key/value storage with a graceful ladder of backends:
 *
 *   1. MMKV — fastest, used in any native build that includes it.
 *   2. AsyncStorage + an in-memory mirror — used in Expo Go and anywhere MMKV
 *      is unavailable. `hydrate()` loads the mirror once at boot so reads stay
 *      synchronous; writes go through the mirror and flush in the background.
 *   3. Memory only — last resort, so a broken storage layer degrades to "this
 *      session won't persist" instead of a crash.
 *
 * Nothing above this module knows or cares which one is live.
 */

type Backend = 'mmkv' | 'async' | 'memory';

interface KeyValue {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  delete(key: string): void;
}

const memory = new Map<string, string>();
let backend: Backend = 'memory';
let mmkv: KeyValue | null = null;
let hydrated = false;

/** Keys the AsyncStorage mirror needs to load at boot. */
const MIRRORED_KEYS: string[] = [];

/**
 * Can MMKV possibly work in this binary?
 *
 * MMKV v4 is built on Nitro modules, and simply importing it throws when the
 * native side is absent — as it is in Expo Go and on web. Probing the native
 * registry first is what keeps that from happening: `TurboModuleRegistry.get`
 * returns null instead of throwing, so we can answer the question without
 * touching MMKV's own code and without a red error box in development.
 */
function isMmkvSupported(): boolean {
  if (Platform.OS === 'web') return false;
  try {
    return TurboModuleRegistry.get('NitroModules') != null;
  } catch {
    return false;
  }
}

/** The slice of MMKV v4's surface this app uses. */
type MmkvInstance = {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  remove(key: string): boolean;
};

function tryLoadMmkv(): KeyValue | null {
  if (!isMmkvSupported()) return null;
  try {
    // Required lazily so the import only ever runs where it can succeed. Metro
    // resolves it to an empty module when the package is not installed at all
    // (see metro.config.js), hence the shape check.
    const mod = require('react-native-mmkv') as { createMMKV?: (config?: { id?: string }) => MmkvInstance };

    /**
     * v4 is a different API from v3, in two ways that both fail *silently*:
     *
     *  - `new MMKV(...)` is gone. `MMKV` is now a **type-only** export, so it is
     *    `undefined` at runtime and a `typeof mod.MMKV !== 'function'` guard is
     *    always true. The instance is built by `createMMKV()` instead.
     *  - `delete(key)` is now `remove(key)`.
     *
     * Because the guard simply returned null, MMKV never loaded on *any* native
     * build and every player silently ran on the AsyncStorage fallback — which
     * works, so nothing ever surfaced it except the backend line in Settings.
     */
    if (typeof mod?.createMMKV !== 'function') return null;
    const instance = mod.createMMKV({ id: 'pulse-blocks' });

    const store: KeyValue = {
      getString: (key) => instance.getString(key),
      set: (key, value) => instance.set(key, value),
      delete: (key) => {
        instance.remove(key);
      },
    };

    // Prove it actually works before committing to it.
    store.set('__probe', '1');
    store.delete('__probe');
    return store;
  } catch {
    return null;
  }
}

/** Set once the AsyncStorage profile has been copied into MMKV. */
const MIGRATED_KEY = 'pb.storage.mmkvMigrated';

/**
 * One-time move of an existing profile from AsyncStorage into MMKV.
 *
 * MMKV never actually loaded before (see `tryLoadMmkv`), so every existing
 * player's high scores, coins and saved run are sitting in AsyncStorage.
 * Selecting MMKV without bringing them across would read an empty store, which
 * is indistinguishable from a wiped profile. The marker means this costs one
 * `multiGet` once, ever.
 */
async function migrateAsyncStorageInto(store: KeyValue): Promise<void> {
  if (store.getString(MIGRATED_KEY) != null) return;
  try {
    const entries = await AsyncStorage.multiGet(MIRRORED_KEYS);
    for (const [key, value] of entries) {
      // Never overwrite something MMKV already holds — it is the newer write.
      if (typeof value === 'string' && store.getString(key) == null) {
        store.set(key, value);
      }
    }
  } catch {
    // An unreadable AsyncStorage is no reason to refuse the faster backend.
  }
  store.set(MIGRATED_KEY, '1');
}

export function registerPersistedKey(key: string): void {
  if (!MIRRORED_KEYS.includes(key)) MIRRORED_KEYS.push(key);
}

/**
 * Must be awaited once during boot. Safe to call more than once.
 * Never rejects — a storage failure downgrades the backend instead.
 */
export async function hydrateStorage(): Promise<void> {
  if (hydrated) return;
  hydrated = true;

  mmkv = tryLoadMmkv();
  if (mmkv) {
    backend = 'mmkv';
    await migrateAsyncStorageInto(mmkv);
    return;
  }

  try {
    const entries = await AsyncStorage.multiGet(MIRRORED_KEYS);
    for (const [key, value] of entries) {
      if (typeof value === 'string') memory.set(key, value);
    }
    backend = 'async';
  } catch {
    backend = 'memory';
  }
}

export function getItem(key: string): string | undefined {
  try {
    if (backend === 'mmkv' && mmkv) return mmkv.getString(key) ?? undefined;
  } catch {
    // fall through to the mirror
  }
  return memory.get(key);
}

export function setItem(key: string, value: string): void {
  memory.set(key, value);
  try {
    if (backend === 'mmkv' && mmkv) {
      mmkv.set(key, value);
      return;
    }
    if (backend === 'async') {
      void AsyncStorage.setItem(key, value).catch(() => undefined);
    }
  } catch {
    // Writing failed; the in-memory value still keeps this session consistent.
  }
}

export function removeItem(key: string): void {
  memory.delete(key);
  try {
    if (backend === 'mmkv' && mmkv) {
      mmkv.delete(key);
      return;
    }
    if (backend === 'async') {
      void AsyncStorage.removeItem(key).catch(() => undefined);
    }
  } catch {
    // ignored on purpose
  }
}

export function getJson<T>(key: string): T | undefined {
  const raw = getItem(key);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    // Corrupt entry — drop it so we don't trip over it again next launch.
    removeItem(key);
    return undefined;
  }
}

export function setJson(key: string, value: unknown): void {
  try {
    setItem(key, JSON.stringify(value));
  } catch {
    // Unserialisable value: skip rather than crash the game loop.
  }
}

export function storageBackend(): Backend {
  return backend;
}

export * from './schema';
