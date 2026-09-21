#!/usr/bin/env bash
# Stress-test rotation on the booted iOS Simulator (macOS + Simulator.app required).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="$ROOT/.pocket/rotation-stress"
mkdir -p "$OUT"

SIM_APP=""
for candidate in \
  "/Applications/Xcode.app/Contents/Developer/Applications/Simulator.app" \
  "/Applications/Simulator.app"; do
  if [[ -d "$candidate" ]]; then
    SIM_APP="$candidate"
    break
  fi
done

if [[ -z "$SIM_APP" ]]; then
  echo "rotation-stress: Simulator.app not found — rotate manually and inspect logs."
  exit 0
fi

open -a "$SIM_APP" || true
sleep 2

rotate() {
  osascript <<'AS' 2>/dev/null || true
tell application "System Events"
  key code 123 using {command down}
end tell
AS
  sleep 2.5
}

for n in 1 2 3 4 5 6; do
  rotate
  xcrun simctl io booted screenshot "$OUT/after-$n.png" 2>/dev/null || true
done

xcrun simctl spawn booted log show --last 3m --style compact \
  --predicate 'process == "iossimulator" AND eventMessage CONTAINS "[pocket-home]"' 2>&1 \
  | tee "$OUT/logs.txt" | tail -30

echo "rotation-stress: screenshots in $OUT"
