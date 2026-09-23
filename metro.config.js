const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

/**
 * Optional native modules.
 *
 * Both the ad layer and the storage layer probe for their native module at
 * runtime and degrade gracefully when it is absent — but Metro resolves
 * `require()` statically, so without this the bundle would fail outright rather
 * than fall back. Resolving a missing module to an empty one lets the runtime
 * probe do its job; `loadModule()` and `tryLoadMmkv()` both treat an empty
 * module the same as a missing one.
 *
 * MMKV is listed because it is only usable in a native build with its Nitro
 * peer dependency present; in Expo Go the app falls back to AsyncStorage.
 *
 * There are two distinct reasons to stub a module, and both are needed:
 *
 * 1. **Not installed at all.** `require.resolve` throws, so the bundle would
 *    fail for anyone who has not run the optional install step.
 * 2. **Installed, but native-only on web.** This one is easy to miss, because it
 *    only appears *after* the package is added. `react-native-google-mobile-ads`
 *    reaches into `react-native/Libraries/Utilities/codegenNativeComponent`,
 *    which does not exist in react-native-web, so `npm run web` fails to bundle
 *    with "Importing native-only module ... on web". The runtime already refuses
 *    to touch these modules on web — `isMmkvSupported()` checks `Platform.OS`
 *    and the ad services probe `TurboModuleRegistry` first — so nothing reads
 *    the stub; it exists purely so Metro's static traversal has something to
 *    resolve.
 */
const OPTIONAL_MODULES = [
  'react-native-google-mobile-ads',
  'react-native-mmkv',
  'react-native-nitro-modules',
  'expo-tracking-transparency',
];

/**
 * Modules that must be stubbed on web even when they are installed, because
 * they import React Native internals that react-native-web does not ship.
 */
const NATIVE_ONLY_ON_WEB = new Set([
  'react-native-google-mobile-ads',
  'react-native-mmkv',
  'react-native-nitro-modules',
]);

const parentResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (OPTIONAL_MODULES.includes(moduleName)) {
    if (platform === 'web' && NATIVE_ONLY_ON_WEB.has(moduleName)) {
      return { type: 'empty' };
    }
    try {
      require.resolve(moduleName, { paths: [__dirname] });
    } catch {
      return { type: 'empty' };
    }
  }
  return parentResolveRequest
    ? parentResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
