import { describe, expect, test } from "bun:test";
import { retargetTbd } from "../tools/ios-native/stub-sdk.ts";

const LIBOBJC = `--- !tapi-tbd
tbd-version:     4
targets:         [ arm64e-ios, arm64e.x1-ios ]
install-name:    '/usr/lib/libobjc.A.dylib'
exports:
  - targets:         [ arm64e-ios, arm64e.x1-ios ]
    symbols:         [ _objc_msgSend ]
...
`;

describe("stub SDK retargeting (32-bit iOS tiers)", () => {
  test("rewrites every target list to the tier's architecture", () => {
    const out = retargetTbd(LIBOBJC, "armv7");
    expect(out).not.toContain("arm64");
    expect(out.match(/\[ armv7-ios \]/g)?.length).toBe(3); // file, export, added ABI entry
  });

  test("adds 32-bit-only ABI exports to the library that has them", () => {
    const out = retargetTbd(LIBOBJC, "armv7");
    expect(out).toContain("_objc_msgSend_stret");
    expect(out.indexOf("_objc_msgSend_stret")).toBeGreaterThan(out.indexOf("exports:"));
  });

  test("leaves 64-bit retargets without 32-bit extras", () => {
    expect(retargetTbd(LIBOBJC, "arm64")).not.toContain("_stret");
  });
});
