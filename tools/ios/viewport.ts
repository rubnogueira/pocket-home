import type { Viewport } from "../../node_modules/@pocketjs/framework/contracts/spec/platforms.ts";

/**
 * Pocket Home uses a single design canvas from pocket.json for every target
 * that can admit it. Device tiers do not pick different resolutions per model.
 *
 * Legacy iOS 6 / iPhone OS 3 hosts are the exception: their PocketJS profiles
 * only admit phone-sized native panels, so those stacks may apply a temporary
 * viewport override at build time (see hosts/ios/legacy/stacks/*.stack.json).
 */
export function manifestLogicalViewport(manifest: unknown): Viewport {
  if (!manifest || typeof manifest !== "object") {
    throw new Error("viewport: invalid manifest");
  }
  const app = (manifest as { app?: { viewport?: unknown } }).app;
  const viewport = app?.viewport;
  if (!viewport || typeof viewport !== "object") {
    throw new Error("viewport: pocket.json must declare app.viewport");
  }
  const fixed = (viewport as { fixed?: { logical?: Viewport }; logical?: Viewport }).fixed;
  const logical = fixed?.logical ?? (viewport as { logical?: Viewport }).logical;
  if (
    !logical ||
    logical.length !== 2 ||
    !logical.every((n) => typeof n === "number" && Number.isInteger(n) && n > 0)
  ) {
    throw new Error("viewport: pocket.json needs app.viewport.fixed.logical");
  }
  return [logical[0], logical[1]];
}
