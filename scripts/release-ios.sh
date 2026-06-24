#!/usr/bin/env bash
#
# Build a production iOS binary on EAS and submit it to TestFlight.
#
# The production build profile uses remote versioning with autoIncrement, so the
# build number bumps itself — no manual version edits needed. `--auto-submit`
# hands the finished build to the `production` submit profile in eas.json, which
# uploads it to App Store Connect (it then appears in TestFlight after Apple
# finishes processing).
#
# Usage:
#   pnpm release:ios                       # run checks, then build + submit
#   SKIP_CHECKS=1 pnpm release:ios         # skip local checks
#   pnpm release:ios --clear-cache         # extra flags are forwarded to eas
#   pnpm release:ios --what-to-test "Fixes timer past 1h; board animations"
#
set -euo pipefail

cd "$(dirname "$0")/.."

if [ "${SKIP_CHECKS:-0}" != "1" ]; then
  echo "▶ Running CI checks (typecheck, lint, format, knip, tests)…"
  pnpm ci:check
else
  echo "⏭  Skipping local checks (SKIP_CHECKS=1)"
fi

echo "▶ Building iOS (production) and submitting to TestFlight…"
eas build --platform ios --profile production --auto-submit "$@"

echo "✅ Build submitted. Track it in App Store Connect → TestFlight once Apple finishes processing."
