import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { resolveIosNativeBuildPlan } from "../tools/ios-native/profile.ts";
import { DEFAULT_IOS_NATIVE_TIER } from "../tools/ios-native/tiers.ts";

const root = join(import.meta.dir, "..");

describe("ios-native profile", () => {
  test("resolves pocket.json for default tier using manifest viewport", () => {
    const manifest = JSON.parse(readFileSync(join(root, "pocket.json"), "utf8"));
    const plan = resolveIosNativeBuildPlan(manifest, DEFAULT_IOS_NATIVE_TIER);
    expect(plan.target.id).toBe("ios-native-armv7-ios9");
    expect(plan.viewport.logical).toEqual([1024, 768]);
    expect(plan.viewport.rasterDensity).toBe(1);
    expect(plan.app.output).toBe("pocket-home-main");
  });

  test("accepts alternate logical size for same tier", () => {
    const manifest = JSON.parse(readFileSync(join(root, "pocket.json"), "utf8"));
    manifest.app.viewport.fixed.logical = [568, 320];
    const plan = resolveIosNativeBuildPlan(manifest, "armv7-ios9");
    expect(plan.viewport.logical).toEqual([568, 320]);
  });

  test("resolves arm64 jailbreak tier", () => {
    const manifest = JSON.parse(readFileSync(join(root, "pocket.json"), "utf8"));
    const plan = resolveIosNativeBuildPlan(manifest, "arm64-ios12");
    expect(plan.target.id).toBe("ios-native-arm64-ios12");
    expect(plan.viewport.rasterDensity).toBe(2);
  });
});
