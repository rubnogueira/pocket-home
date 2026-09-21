import { rawPanelLogical } from "./ios-runtime-viewport";

let lastSample = { width: 0, height: 0 };
let consecutiveStable = 0;

const STABLE_SAMPLES = 2;

export function noteWindowBoundsSample(): boolean {
  const panel = rawPanelLogical();
  if (panel.width <= 0 || panel.height <= 0) {
    consecutiveStable = 0;
    return false;
  }
  if (panel.width === lastSample.width && panel.height === lastSample.height) {
    consecutiveStable += 1;
  } else {
    lastSample = { width: panel.width, height: panel.height };
    consecutiveStable = 0;
  }
  return consecutiveStable >= STABLE_SAMPLES;
}

export function resetWindowBoundsStability(): void {
  lastSample = { width: 0, height: 0 };
  consecutiveStable = 0;
}

export function onOrientationEvent(): void {
  resetWindowBoundsStability();
}

export { settledPanelLogical } from "./ios-runtime-viewport";
