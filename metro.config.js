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
 */
const OPTIONAL_MODULES = [
  'react-native-google-mobile-ads',
  'react-native-mmkv',
  'react-native-nitro-modules',
  'expo-tracking-transparency',
];

const parentResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (OPTIONAL_MODULES.includes(moduleName)) {
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
