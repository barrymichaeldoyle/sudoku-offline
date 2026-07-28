#!/usr/bin/env bash
#
# Capture the raw App Store screenshots on the iPhone/iPad simulators, then
# composite the framed marketing images (scripts/generate-store-screenshots.mjs).
#
# Self-sufficient: builds a Release simulator app with the hidden screenshot
# routes enabled, boots the simulators if needed, installs that build, and
# captures each route without Metro or development-client UI.
#
# It drives the hidden sudokuoffline://shots/* deep links (src/app/shots/) and
# writes the raws to assets/store/screenshots/raw/, handling the simulator /
# devtools footguns that otherwise need manual taps:
#   - pre-approves the custom URL scheme so SpringBoard never asks
#     "Open in Sudoku?" (respring only when the approval was missing)
#   - pins a clean status bar (09:41, full battery/signal) and clears it after
#
# Usage:
#   pnpm capture:screenshots
#
set -euo pipefail

cd "$(dirname "$0")/.."

BUNDLE_ID="com.barrymichaeldoyle.sudokuoffline"
SCHEME="sudokuoffline"
RAW_DIR="$PWD/assets/store/screenshots/raw"
BUILD_DIR="${TMPDIR%/}/sudoku-store-screenshots"
APP_SRC="$BUILD_DIR/Build/Products/Release-iphonesimulator/Sudoku.app"
SIM_ARCH=$(uname -m)
SHOTS=(
  "1-home:home?theme=light"
  "2-game:game?theme=light"
  "3-dark:game?theme=dark"
  "4-hints:hint?theme=light"
  "5-history:history?theme=light"
  "6-stats:stats?theme=light"
)

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

install_app() { # install_app <udid> <label> <source .app path>
  local udid=$1 label=$2 src=$3
  echo "▶ Installing screenshot build on $label simulator…"
  xcrun simctl install "$udid" "$src"
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
  # A Release build has its JavaScript bundle embedded, so it launches without
  # Metro and cannot put development-client UI into a store screenshot.
  xcrun simctl terminate "$udid" "$BUNDLE_ID" 2>/dev/null || true
  sleep 1
  xcrun simctl launch "$udid" "$BUNDLE_ID" >/dev/null
  sleep 8
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

echo "▶ Building Release simulator app in screenshot mode…"
EXPO_PUBLIC_SCREENSHOT_MODE=1 xcodebuild \
  -workspace ios/SudokuOffline.xcworkspace \
  -scheme SudokuOffline \
  -configuration Release \
  -sdk iphonesimulator \
  -destination "generic/platform=iOS Simulator" \
  -derivedDataPath "$BUILD_DIR" \
  CODE_SIGNING_ALLOWED=NO \
  ONLY_ACTIVE_ARCH=YES \
  ARCHS="$SIM_ARCH" \
  build >/tmp/sudoku-screenshot-build.log
[ -d "$APP_SRC" ] || {
  echo "✖ Screenshot build failed (see /tmp/sudoku-screenshot-build.log)" >&2
  exit 1
}

install_app "$IPHONE_UDID" iPhone "$APP_SRC"
install_app "$IPAD_UDID" iPad "$APP_SRC"

for udid in "$IPHONE_UDID" "$IPAD_UDID"; do prepare_device "$udid"; done
capture_device "$IPHONE_UDID" iphone
capture_device "$IPAD_UDID" ipad
for udid in "$IPHONE_UDID" "$IPAD_UDID"; do xcrun simctl status_bar "$udid" clear; done

echo "▶ Compositing framed screenshots…"
pnpm generate:screenshots
