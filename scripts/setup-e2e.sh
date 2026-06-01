#!/usr/bin/env bash
#
# Provision the local environment to run the Playwright e2e suite.
# Mirrors .github/workflows/ci.yml (the `e2e` job). Idempotent — safe to re-run.
#
# The e2e harness loads the built extension via chromium.launchPersistentContext
# with headless:false, so it needs a headed Chromium and a display. CI's runner
# ships xvfb; fresh / ephemeral containers do not, so we install it here.
#
# Usage:  npm run e2e:setup   (or: bash scripts/setup-e2e.sh)
# Then:   npm run test:e2e:local
#
set -euo pipefail

# Use sudo only when not already root and sudo is available.
SUDO=""
if [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null 2>&1; then
  SUDO="sudo"
fi

if ! command -v xvfb-run >/dev/null 2>&1; then
  echo "==> Installing xvfb (virtual display for headed Chromium)"
  $SUDO apt-get update
  $SUDO apt-get install -y xvfb
else
  echo "==> xvfb already installed"
fi

echo "==> Installing Playwright Chromium"
npx playwright install chromium

echo "==> Installing Chromium system libraries"
$SUDO npx playwright install-deps chromium

echo "==> Done. Run the e2e suite with: npm run test:e2e:local"
