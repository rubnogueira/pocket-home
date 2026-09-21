import { describe, expect, test } from "bun:test";
import { iosNativeTiers } from "../tools/ios-native/load-tiers.ts";
import { listIosNativeTierIds } from "../tools/ios-native/tiers.ts";

describe("ios-native tier manifests", () => {
  test("loads every *.tier.json under hosts/ios/takeover/tiers", () => {
    const ids = listIosNativeTierIds();
    expect(ids.length).toBeGreaterThanOrEqual(5);
    expect(ids).toContain("armv7-ios7");
    expect(ids).toContain("arm64-ios12");
    const tiers = iosNativeTiers();
    expect(tiers["armv7-ios9"].rustTargetSpec).toBeDefined();
    expect(tiers["arm64-ios12"].rustTargetSpec).toBeUndefined();
  });
});
