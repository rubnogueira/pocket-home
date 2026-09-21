import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PROJECT_ROOT } from "../paths.ts";
import { lookupDeviceProfile } from "../ios/device-catalog.ts";
import { manifestLogicalViewport } from "../ios/viewport.ts";
import type { LegacyProfileId } from "./profiles.ts";

export interface LegacyStack {
  readonly id: string;
  readonly label: string;
  readonly iosMin: string;
  readonly iosMax: string;
  readonly logicalViewport: readonly [number, number];
  readonly rasterDensity: number;
  readonly profile: LegacyProfileId | null;
  readonly frameworkNativeTool: string | null;
  readonly nativeTier?: string;
  /** Phone-era hosts that cannot admit the tablet canvas in pocket.json. */
  readonly overrideViewportForBuild?: boolean;
  readonly unsupportedReason: string | null;
}

import { IOS_LEGACY_STACKS_DIR } from "../ios/paths.ts";

export function legacyStacks(): LegacyStack[] {
  const stacks: LegacyStack[] = [];
  for (const name of readdirSync(IOS_LEGACY_STACKS_DIR).sort()) {
    if (!name.endsWith(".stack.json")) continue;
    const stack = JSON.parse(
      readFileSync(join(IOS_LEGACY_STACKS_DIR, name), "utf8"),
    ) as LegacyStack;
    stacks.push(stack);
  }
  return stacks;
}

export function resolveLegacyStack(id: string): LegacyStack {
  const stack = legacyStacks().find((s) => s.id === id);
  if (!stack) {
    throw new Error(
      `unknown legacy stack "${id}" — choose: ${legacyStacks()
        .map((s) => s.id)
        .join(", ")}`,
    );
  }
  return stack;
}

export function buildableLegacyStacks(): LegacyStack[] {
  return legacyStacks().filter((s) => s.profile !== null && !s.unsupportedReason);
}

export function legacyBuildLogical(stack: LegacyStack, productType?: string): [number, number] {
  const fromEnv = process.env.POCKET_IOS_LEGACY_LOGICAL;
  if (fromEnv) {
    const parts = fromEnv.split(",").map((n) => Number.parseInt(n.trim(), 10));
    if (parts.length === 2 && parts.every((n) => Number.isInteger(n) && n > 0)) {
      return [parts[0], parts[1]];
    }
  }
  if (stack.overrideViewportForBuild) {
    const type = productType ?? process.env.POCKET_IOS_DEVICE_PROFILE;
    if (type) {
      const profile = lookupDeviceProfile(type);
      return [profile.legacyLogical[0], profile.legacyLogical[1]];
    }
    return [stack.logicalViewport[0], stack.logicalViewport[1]];
  }
  const manifestPath = join(PROJECT_ROOT, "pocket.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const logical = manifestLogicalViewport(manifest);
  return [logical[0], logical[1]];
}

export function manifestForStack(
  stack: LegacyStack,
  manifestPath: string,
  productType?: string,
): unknown {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    app?: { viewport?: { fixed?: { logical?: number[] } } };
  };
  if (!manifest.app?.viewport?.fixed) {
    throw new Error("ios-legacy: pocket.json needs app.viewport.fixed");
  }
  const logical = legacyBuildLogical(stack, productType);
  manifest.app.viewport.fixed.logical = [...logical];
  return manifest;
}

export function stackPlanPath(stackId: string): string {
  return join(PROJECT_ROOT, ".pocket/ios-legacy", stackId, "pocket-home.plan.json");
}

export function stackGuestDir(stackId: string): string {
  return join(PROJECT_ROOT, "dist/ios-legacy", stackId, "guest");
}
