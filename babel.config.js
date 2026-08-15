/**
 * babel-preset-expo wires up the React Native Worklets plugin automatically when
 * react-native-reanimated is installed, so the preset is all that is needed.
 */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
