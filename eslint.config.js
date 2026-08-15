const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  ...expoConfig,
  {
    ignores: ['node_modules/**', 'dist/**', '.expo/**', 'android/**', 'ios/**', 'coverage/**'],
  },
  {
    rules: {
      /**
       * React Compiler treats `sharedValue.value = x` as mutating an immutable
       * binding. That assignment *is* the Reanimated API, and these writes are
       * intentionally outside React's render model — they drive the UI thread.
       * The rest of the react-hooks rule set (refs, set-state-in-effect,
       * rules-of-hooks) stays on and is respected.
       */
      'react-hooks/immutability': 'off',
    },
  },
  {
    // These two adapters probe for optional native modules at runtime, which a
    // static `import` cannot express — the module may simply not be installed.
    files: [
      'src/services/ads/AdMobAdService.ts',
      'src/services/ads/consent.ts',
      'src/services/storage/index.ts',
    ],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    // Build tooling runs on Node, not in the app bundle.
    files: ['scripts/**/*.js', '*.config.js'],
    languageOptions: {
      globals: {
        __dirname: 'readonly',
        module: 'writable',
        require: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        console: 'readonly',
      },
    },
  },
];
