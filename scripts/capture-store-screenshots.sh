#!/usr/bin/env bash
#
# Capture the raw App Store screenshots on booted simulators, then composite
# the framed marketing images (scripts/generate-store-screenshots.mjs).
#
# Drives the hidden sudokuoffline://shots/* deep links (src/app/shots/) on the
# booted iPhone and iPad simulators and writes the raws to
# assets/store/screenshots/raw/. Handles the simulator/devtools footguns that
# otherwise need manual taps:
#   - pre-approves the custom URL scheme so SpringBoard never asks
#     "Open in Sudoku?" (respring only when the approval was missing)
#   - hides the Expo dev-menu floating Tools button and skips its onboarding
#   - pins a clean status bar (09:41, full battery/signal) and clears it after
#
# Prerequisites:
#   - iPhone + iPad simulators booted, with the app installed on both (the
#     iPhone build installs onto the iPad sim as-is via `simctl install`)
#   - Metro running in screenshot mode: EXPO_PUBLIC_SCREENSHOT_MODE=1 npx expo start
#     (the flag is baked in at bundle time, so a plain dev server won't do)
#
# Usage:
#   pnpm capture:screenshots               # capture both devices + composite
#
set -euo pipefail

cd "$(dirname "$0")/.."

BUNDLE_ID="com.barrymichaeldoyle.sudokuoffline"
SCHEME="sudokuoffline"
RAW_DIR="$PWD/assets/store/screenshots/raw"
SHOTS=("1-home:home?theme=light" "2-game:game?theme=light" "3-stats:stats?theme=light" "4-dark:game?theme=dark")

booted_udid() { # booted_udid <name-pattern>
  xcrun simctl list devices booted | grep "$1" | grep -oE '[0-9A-F-]{36}' | head -1
}

IPHONE_UDID=$(booted_udid iPhone) || true
IPAD_UDID=$(booted_udid iPad) || true
[ -n "${IPHONE_UDID:-}" ] || { echo "✖ No booted iPhone simulator found" >&2; exit 1; }
[ -n "${IPAD_UDID:-}" ] || { echo "✖ No booted iPad simulator found" >&2; exit 1; }

lsof -nP -iTCP:8081 -sTCP:LISTEN >/dev/null 2>&1 || {
  echo "✖ Metro is not running on :8081. Start it with:" >&2
  echo "    EXPO_PUBLIC_SCREENSHOT_MODE=1 npx expo start" >&2
  exit 1
}

prepare_device() { # prepare_device <udid>
  local udid=$1
  # Approve the URL scheme so `simctl openurl` never shows "Open in Sudoku?".
  # The approval only takes effect after a SpringBoard restart, so respring
  # when this device hadn't approved it yet.
  local approval_key="com.apple.CoreSimulator.CoreSimulatorBridge-->$SCHEME"
  if ! xcrun simctl spawn "$udid" defaults read com.apple.launchservices.schemeapproval \
      2>/dev/null | grep -q "$approval_key"; then
    xcrun simctl spawn "$udid" defaults write com.apple.launchservices.schemeapproval \
      "$approval_key" -string "$BUNDLE_ID"
    xcrun simctl spawn "$udid" launchctl kickstart -k system/com.apple.SpringBoard 2>/dev/null || true
    sleep 6
  fi
  # No dev-menu floating gear or first-launch onboarding sheet in captures.
  xcrun simctl spawn "$udid" defaults write "$BUNDLE_ID" EXDevMenuShowFloatingActionButton -bool NO
  xcrun simctl spawn "$udid" defaults write "$BUNDLE_ID" EXDevMenuIsOnboardingFinished -bool YES
  xcrun simctl status_bar "$udid" override --time 09:41 --batteryState charged \
    --batteryLevel 100 --cellularBars 4 --wifiBars 3
}

capture_device() { # capture_device <udid> <prefix>
  local udid=$1 prefix=$2
  echo "▶ Capturing $prefix raws…"
  # Fresh launch through the dev client, pointed at the local Metro server.
  xcrun simctl terminate "$udid" "$BUNDLE_ID" 2>/dev/null || true
  sleep 1
  xcrun simctl openurl "$udid" "$SCHEME://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081"
  sleep 12
  for shot in "${SHOTS[@]}"; do
    local name="${shot%%:*}" link="${shot#*:}"
    xcrun simctl openurl "$udid" "$SCHEME://shots/$link"
    sleep 6
    xcrun simctl io "$udid" screenshot "$RAW_DIR/$prefix-$name.png" >/dev/null
    echo "  $prefix-$name.png"
  done
}

for udid in "$IPHONE_UDID" "$IPAD_UDID"; do prepare_device "$udid"; done
capture_device "$IPHONE_UDID" iphone
capture_device "$IPAD_UDID" ipad
for udid in "$IPHONE_UDID" "$IPAD_UDID"; do xcrun simctl status_bar "$udid" clear; done

echo "▶ Compositing framed screenshots…"
pnpm generate:screenshots
