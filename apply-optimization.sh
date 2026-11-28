#!/usr/bin/env bash
# Applies the MK Stadium-only / Classic-Kart-only optimization patch.
# Usage (from anywhere inside your mario-kart repo):  bash apply-optimization.sh
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PATCH="$HERE/mario-kart-optimization.patch"
cd "$(git rev-parse --show-toplevel)"
G=app/src/main/assets/game
[ -f "$PATCH" ] || { echo "Missing $PATCH (keep it next to this script)"; exit 1; }
[ -f "$G/index.html" ] || { echo "Run this inside the mario-kart repo"; exit 1; }
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "You have uncommitted changes. Commit or stash them first, then re-run."; exit 1
fi

echo "[1/4] Checking the patch applies cleanly..."
git apply --check --binary "$PATCH" || { echo "The patch does not apply cleanly to your current files."; echo "Make sure you are on the latest main (commit 4fbab0f or newer with no edits to the files it touches)."; exit 1; }

echo "[2/4] Applying the patch (code, tests, optimized kart models)..."
git apply --binary --index "$PATCH"

echo "[3/4] Removing the old circuit assets, old karts/characters and unused textures..."
git rm -r -q -f --ignore-unmatch -- \
  "$G"/models/character-*.glb "$G"/models/kart-*.glb \
  "$G"/models/race.glb "$G"/models/race-future.glb "$G"/models/sedan-sports.glb \
  "$G"/models/nature "$G"/models/racing "$G"/models/Textures \
  "$G"/textures "$G"/art
# git rm leaves empty folders behind on some systems
find "$G/models" "$G" -type d -empty -delete 2>/dev/null || true

echo "[4/4] Running the test suite..."
if command -v npm >/dev/null 2>&1; then
  npm test 2>&1 | grep -E "^# (tests|pass|fail)|^not ok" || true
else
  echo "(npm not found - skipped tests)"
fi
echo
echo "Done. Review with:  git status --short | head"
echo "Then commit:        git commit -m \"perf: MK Stadium + Classic Kart only, crowd/shadow/memory optimizations\""
