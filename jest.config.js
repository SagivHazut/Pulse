/**
 * Engine tests run on plain Node with ts-jest.
 *
 * Everything under src/game, src/utils and src/services/storage/schema.ts is
 * deliberately free of React Native imports, so the gameplay rules can be tested
 * without a native runtime or a Metro transform pipeline.
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.jest.json' }],
  },
  collectCoverageFrom: [
    'src/game/**/*.ts',
    'src/utils/**/*.ts',
    'src/services/storage/schema.ts',
  ],
};
