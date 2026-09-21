import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { resolveLegacyPlan, type LegacyProfileId } from "../tools/ios-legacy/profiles.ts";
import { buildableLegacyStacks, manifestForStack } from "../tools/ios-legacy/stacks.ts";
import { listIosNativeTierIds } from "../tools/ios-native/tiers.ts";

const root = join(import.meta.dir, "..");
const manifestPath = join(root, "pocket.json");

describe("iOS coverage", () => {
  test("device tiers cover iOS 7 through 12+", () => {
    const ids = listIosNativeTierIds();
    expect(ids).toEqual(
      expect.arrayContaining([
        "armv7-ios7",
        "armv7-ios8",
        "armv7-ios9",
        "arm64-ios11",
        "arm64-ios12",
      ]),
    );
  });

  test("every buildable legacy stack resolves pocket-home", () => {
    for (const stack of buildableLegacyStacks()) {
      const manifest = manifestForStack(stack, manifestPath);
      const plan = resolveLegacyPlan(manifest, stack.profile as LegacyProfileId);
      expect(plan.viewport.logical).toEqual(stack.logicalViewport);
    }
  });

  test("iphone2g-ios3 stack is buildable", () => {
    const stack = JSON.parse(
      readFileSync(join(root, "hosts/ios/legacy/stacks/iphone2g-ios3.stack.json"), "utf8"),
    );
    expect(stack.profile).toBe("iphone2g");
    expect(stack.frameworkNativeTool).toBe("iphone2g");
  });
});
