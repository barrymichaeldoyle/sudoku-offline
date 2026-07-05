#!/usr/bin/env bash
#
# Capture the raw App Store screenshots on the iPhone/iPad simulators, then
# composite the framed marketing images (scripts/generate-store-screenshots.mjs).
#
# Self-sufficient: boots the simulators if they aren't running, installs the
# app onto them from the newest local simulator build, and starts Metro in
# screenshot mode if nothing is listening on :8081 (stopping it again after).
# The only thing it can't conjure is a simulator build — if none exists yet,
# run `npx expo run:ios` once and re-run.
#
# It drives the hidden sudokuoffline://shots/* deep links (src/app/shots/) and
# writes the raws to assets/store/screenshots/raw/, handling the simulator /
# devtools footguns that otherwise need manual taps:
#   - pre-approves the custom URL scheme so SpringBoard never asks
#     "Open in Sudoku?" (respring only when the approval was missing)
#   - hides the Expo dev-menu floating Tools button and skips its onboarding
#   - pins a clean status bar (09:41, full battery/signal) and clears it after
#
# Usage:
#   pnpm capture:screenshots
#
# If Metro is already running on :8081 it is reused as-is — it must have been
# started with EXPO_PUBLIC_SCREENSHOT_MODE=1 (the flag is baked in at bundle
# time), or the /shots routes will be inert and the captures wrong.
#
set -euo pipefail

cd "$(dirname "$0")/.."

BUNDLE_ID="com.barrymichaeldoyle.sudokuoffline"
SCHEME="sudokuoffline"
RAW_DIR="$PWD/assets/store/screenshots/raw"
SHOTS=("1-home:home?theme=light" "2-game:game?theme=light" "3-stats:stats?theme=light" "4-dark:game?theme=dark")

# The raw capture sizes the compositor expects (iPhone 1206x2622, iPad
# 2064x2752) come from these models — bump both together when Apple retires
# the simulators.
IPHONE_NAME="iPhone 17 Pro"
IPAD_NAME="iPad Pro 13-inch"

find_udid() { # find_udid <device name> — prefers a booted match, else the newest runtime's
  local name=$1 udid
  udid=$(xcrun simctl list devices booted | grep -F "$name (" | grep -oE '[0-9A-F-]{36}' | head -1)
  [ -n "$udid" ] || udid=$(xcrun simctl list devices available | grep -F "$name (" | grep -oE '[0-9A-F-]{36}' | tail -1)
  [ -n "$udid" ] || { echo "✖ No \"$name\" simulator found (xcrun simctl list devices)" >&2; exit 1; }
  echo "$udid"
}

ensure_booted() { # ensure_booted <udid> <label>
  local udid=$1 label=$2
  if ! xcrun simctl list devices booted | grep -q "$udid"; then
    echo "▶ Booting $label simulator…"
    xcrun simctl boot "$udid"
    xcrun simctl bootstatus "$udid" -b >/dev/null
  fi
}

installed_app_path() { # installed_app_path <udid>
  xcrun simctl get_app_container "$1" "$BUNDLE_ID" app 2>/dev/null || true
}

ensure_app_installed() { # ensure_app_installed <udid> <label> <source .app path>
  local udid=$1 label=$2 src=$3
  if [ -z "$(installed_app_path "$udid")" ]; then
    echo "▶ Installing app on $label simulator…"
    xcrun simctl install "$udid" "$src"
  fi
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
  # No dev-menu floating gear, first-launch onboarding sheet, or menu-at-launch
  # in captures (fresh installs default to showing the menu on first connect).
  xcrun simctl spawn "$udid" defaults write "$BUNDLE_ID" EXDevMenuShowFloatingActionButton -bool NO
  xcrun simctl spawn "$udid" defaults write "$BUNDLE_ID" EXDevMenuIsOnboardingFinished -bool YES
  xcrun simctl spawn "$udid" defaults write "$BUNDLE_ID" EXDevMenuShowsAtLaunch -bool NO
  xcrun simctl status_bar "$udid" override --time 09:41 --batteryState charged \
    --batteryLevel 100 --cellularBars 4 --wifiBars 3
}

open_url() { # open_url <udid> <url> — retries: right after a fresh install the
  # scheme may not be registered with LaunchServices yet (error 115)
  local udid=$1 url=$2
  for _ in 1 2 3 4 5; do
    xcrun simctl openurl "$udid" "$url" 2>/dev/null && return 0
    sleep 3
  done
  xcrun simctl openurl "$udid" "$url" # final attempt, surfacing the error
}

capture_device() { # capture_device <udid> <prefix>
  local udid=$1 prefix=$2
  echo "▶ Capturing $prefix raws…"
  # Fresh launch through the dev client, pointed at the local Metro server.
  # Launching by bundle id first also forces LaunchServices to register the
  # app (and its URL scheme) when it was only just installed.
  xcrun simctl terminate "$udid" "$BUNDLE_ID" 2>/dev/null || true
  sleep 1
  xcrun simctl launch "$udid" "$BUNDLE_ID" >/dev/null
  sleep 3
  open_url "$udid" "$SCHEME://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081"
  sleep 12
  for shot in "${SHOTS[@]}"; do
    local name="${shot%%:*}" link="${shot#*:}"
    open_url "$udid" "$SCHEME://shots/$link"
    sleep 6
    xcrun simctl io "$udid" screenshot "$RAW_DIR/$prefix-$name.png" >/dev/null
    echo "  $prefix-$name.png"
  done
}

IPHONE_UDID=$(find_udid "$IPHONE_NAME")
IPAD_UDID=$(find_udid "$IPAD_NAME")
ensure_booted "$IPHONE_UDID" iPhone
ensure_booted "$IPAD_UDID" iPad
open -a Simulator

# One simulator build serves both devices. Prefer one already installed, else
# the newest expo run:ios product in DerivedData.
APP_SRC=$(installed_app_path "$IPHONE_UDID")
[ -n "$APP_SRC" ] || APP_SRC=$(installed_app_path "$IPAD_UDID")
[ -n "$APP_SRC" ] || APP_SRC=$(ls -td "$HOME"/Library/Developer/Xcode/DerivedData/*/Build/Products/Debug-iphonesimulator/Sudoku.app 2>/dev/null | head -1)
[ -n "$APP_SRC" ] || {
  echo "✖ No simulator build of the app found. Run \`npx expo run:ios\` once, then re-run." >&2
  exit 1
}
ensure_app_installed "$IPHONE_UDID" iPhone "$APP_SRC"
ensure_app_installed "$IPAD_UDID" iPad "$APP_SRC"

# Reuse a running Metro (started with EXPO_PUBLIC_SCREENSHOT_MODE=1), else run
# our own for the duration of the capture.
METRO_PID=""
if lsof -nP -iTCP:8081 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "▶ Reusing Metro on :8081 (must have EXPO_PUBLIC_SCREENSHOT_MODE=1)"
else
  echo "▶ Starting Metro in screenshot mode…"
  EXPO_PUBLIC_SCREENSHOT_MODE=1 npx expo start >/tmp/sudoku-screenshot-metro.log 2>&1 &
  METRO_PID=$!
  for _ in $(seq 1 60); do
    lsof -nP -iTCP:8081 -sTCP:LISTEN >/dev/null 2>&1 && break
    sleep 1
  done
  lsof -nP -iTCP:8081 -sTCP:LISTEN >/dev/null 2>&1 || {
    echo "✖ Metro failed to start (see /tmp/sudoku-screenshot-metro.log)" >&2
    exit 1
  }
fi
stop_metro() {
  if [ -n "$METRO_PID" ]; then
    kill "$METRO_PID" 2>/dev/null || true
    lsof -tiTCP:8081 -sTCP:LISTEN 2>/dev/null | xargs kill 2>/dev/null || true
  fi
}
trap stop_metro EXIT

for udid in "$IPHONE_UDID" "$IPAD_UDID"; do prepare_device "$udid"; done
capture_device "$IPHONE_UDID" iphone
capture_device "$IPAD_UDID" ipad
for udid in "$IPHONE_UDID" "$IPAD_UDID"; do xcrun simctl status_bar "$udid" clear; done

echo "▶ Compositing framed screenshots…"
pnpm generate:screenshots
