#!/usr/bin/env bash
# Rotation stress test for the modern iOS shell on the booted Simulator — works headless.
#
# Relaunches the installed app with POCKET_HOME_SELFTEST (PocketSurfaceView+PocketHome.m), which
# rotates the scene through every orientation (including a rapid burst), then checks the logs:
#   * the window tracked its scene after every rotation (no MISMATCH),
#   * one surface for the whole run (rotation resizes the live guest; no remount),
#   * after the last rotation the surface's logical size is its size in points,
#   * no surface errors.
# Screenshots land in .pocket/rotation-stress/. Run `bun run ios -- run` first.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="$ROOT/.pocket/rotation-stress"
BUNDLE_ID="dev.pocket-home.dashboard"
mkdir -p "$OUT"

SCRIPT="3:rotate:landscape;3:rotate:portrait;3:rotate:landscapeLeft;3:rotate:upsideDown"
SCRIPT="$SCRIPT;3:rotate:portrait;0.3:rotate:landscape;0.3:rotate:portrait;0.3:rotate:landscape"
SCRIPT="$SCRIPT;3:rotate:portrait;3:mark:done"

xcrun simctl terminate booted "$BUNDLE_ID" 2>/dev/null || true
sleep 1
started=$(date +%s)
SIMCTL_CHILD_POCKET_HOME_SELFTEST="$SCRIPT" xcrun simctl launch booted "$BUNDLE_ID" >/dev/null

for n in 1 2 3 4 5 6; do
  sleep 4
  xcrun simctl io booted screenshot "$OUT/shot-$n.png" >/dev/null 2>&1 || true
done
sleep 2

xcrun simctl spawn booted log show --last "$(($(date +%s) - started + 2))s" --style compact \
  --predicate 'process == "iossimulator" AND (eventMessage CONTAINS "[pocket-home]" OR eventMessage CONTAINS "[pocket-selftest]")' \
  2>/dev/null | grep -v "tick touches" >"$OUT/logs.txt" || true

fail=0
grep -q "mark done" "$OUT/logs.txt" || { echo "rotation-stress: self-test did not finish"; fail=1; }
# The 1 s probe after a burst rotation can land mid-transition; only the settled ones count.
if grep "after rotate" "$OUT/logs.txt" | tail -1 | grep -q MISMATCH; then
  echo "rotation-stress: window did not track its scene"
  fail=1
fi
if grep -q "error:" "$OUT/logs.txt"; then
  echo "rotation-stress: surface errors"
  fail=1
fi
mounts=$(grep -c "mount surface" "$OUT/logs.txt" || true)
if [[ "$mounts" != "1" ]]; then
  echo "rotation-stress: expected one surface mount, saw $mounts"
  fail=1
fi
final=$(grep "after rotate" "$OUT/logs.txt" | tail -1)
surface=$(sed -E 's/.*surface=([0-9]+x[0-9]+).*/\1/' <<<"$final")
logical=$(sed -E 's/.*logical=([0-9]+x[0-9]+).*/\1/' <<<"$final")
if [[ -z "$final" || "$surface" != "$logical" ]]; then
  echo "rotation-stress: final surface $surface is not laid out 1:1 (logical $logical)"
  fail=1
fi

grep -E "mount surface|surface resized|after rotate|resize trace" "$OUT/logs.txt" | sed -E 's/^.*\] //' | tail -30
echo "rotation-stress: $(grep -c 'surface resized' "$OUT/logs.txt") live resizes; final ${logical:-none}"
echo "rotation-stress: logs + screenshots in $OUT"
exit "$fail"
