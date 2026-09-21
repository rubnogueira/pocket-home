import type { Viewport } from "../../node_modules/@pocketjs/framework/contracts/spec/platforms.ts";

/** Logical sizes the simulator shell may mount at runtime (ios-dev contract). */
export const IOS_SHELL_ADMISSIBLE_LOGICAL: readonly Viewport[] = [
  [1024, 768],
  [768, 1024],
  [1366, 1024],
  [1024, 1366],
  [1194, 834],
  [834, 1194],
  [1032, 1376],
  [1376, 1032],
  [820, 1180],
  [1180, 820],
  [393, 852],
  [852, 393],
  [430, 932],
  [932, 430],
];

export function iosShellLogicalViewports(manifestLogical: Viewport): Viewport[] {
  const seen = new Set<string>();
  const out: Viewport[] = [];
  for (const vp of [manifestLogical, ...IOS_SHELL_ADMISSIBLE_LOGICAL]) {
    const key = `${vp[0]}x${vp[1]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(vp);
  }
  return out;
}
