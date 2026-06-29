/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",
  testMatch: ["<rootDir>/src/**/*.test.{ts,tsx}"],
  // Registers module mocks (e.g. expo-notifications) before any imports run.
  setupFiles: ["<rootDir>/jest.setup.js"],
  // Mirror the tsconfig path aliases (more specific alias first).
  moduleNameMapper: {
    "^@/assets/(.*)$": "<rootDir>/assets/$1",
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  // pnpm stores packages under node_modules/.pnpm/<name>@<ver>/..., so the
  // allow-list must match the flattened .pnpm directory names. RN/Expo/
  // NativeWind packages ship untranspiled and must be transformed.
  transformIgnorePatterns: [
    "node_modules/.pnpm/(?!(jest-)?react-native|@react-native|@react-navigation|expo|@expo|nativewind)",
  ],
};
