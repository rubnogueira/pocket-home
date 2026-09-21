import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { resolveIosAppBuildPlan } from "../tools/ios-app/profile.ts";

const root = join(import.meta.dir, "..");

describe("ios-app profile", () => {
  test("resolves pocket.json against ios-dev with manifest viewport", () => {
    const manifest = JSON.parse(readFileSync(join(root, "pocket.json"), "utf8"));
    const plan = resolveIosAppBuildPlan(manifest, 2);
    expect(plan.target.id).toBe("ios-dev");
    expect(plan.viewport.logical).toEqual([1024, 768]);
    expect(plan.viewport.rasterDensity).toBe(2);
  });
});
