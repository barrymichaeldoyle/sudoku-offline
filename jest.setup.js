// Mock expo-notifications across the suite. Its real module runs push-token
// auto-registration at import time, which logs an Expo Go warning under Jest
// and pulls in native code we don't exercise. The mock covers the surface
// notificationService uses; tests that need specific behaviour override it.
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn().mockResolvedValue(undefined),
  getPermissionsAsync: jest
    .fn()
    .mockResolvedValue({ granted: false, canAskAgain: true, ios: undefined }),
  requestPermissionsAsync: jest
    .fn()
    .mockResolvedValue({ granted: false, canAskAgain: true, ios: undefined }),
  cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(undefined),
  scheduleNotificationAsync: jest.fn().mockResolvedValue("notification-id"),
  getLastNotificationResponseAsync: jest.fn().mockResolvedValue(null),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  AndroidImportance: { DEFAULT: 3 },
  IosAuthorizationStatus: { PROVISIONAL: 4 },
  SchedulableTriggerInputTypes: { DATE: "date" },
}));
