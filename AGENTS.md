# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

# Running / verifying the app

Run and verify on the **iOS simulator** only (mobile MCP tools or `expo run:ios`).
Do **not** use the web target (`expo start --web`) or a browser (playwright /
chromium): the SQLite layer calls `withExclusiveTransactionAsync`, which is
unsupported on web, so the app crashes on load and nothing DB-backed renders.
