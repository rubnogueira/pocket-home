import { describe, expect, test } from "bun:test";
import type { UsbDeviceIdentity } from "../tools/ios/device-probe.ts";
import { lookupDeviceProfile } from "../tools/ios/device-catalog.ts";
import { nativeTierForDevice, resolveDeployTarget } from "../tools/ios/resolve-deploy-target.ts";
import { resolveLegacyStack } from "../tools/ios-legacy/stacks.ts";

function device(
  partial: Partial<UsbDeviceIdentity> &
    Pick<UsbDeviceIdentity, "productType" | "productVersion" | "cpuArchitecture">,
): UsbDeviceIdentity {
  return {
    udid: "test",
    hardwareModel: "N94AP",
    buildVersion: "10B329",
    deviceName: "Test",
    ...partial,
  };
}

describe("resolve deploy target", () => {
  test("iPad on iOS 9 maps to armv7-ios9 native", () => {
    const target = resolveDeployTarget(
      device({
        productType: "iPad2,5",
        productVersion: "9.3.5",
        cpuArchitecture: "armv7",
      }),
    );
    expect(target.kind).toBe("ios-native-tier");
    expect(target.id).toBe("armv7-ios9");
    expect(target.usesNativeCanvas).toBe(true);
  });

  test("iOS 6 phones and iPods use the armv7-ios6 tier (screen-sized layout)", () => {
    for (const productType of ["iPhone4,1", "iPod4,1", "iPhone2,1"]) {
      const target = resolveDeployTarget(
        device({ productType, productVersion: "6.1.3", cpuArchitecture: "armv7" }),
      );
      expect(target.kind).toBe("ios-native-tier");
      expect(target.id).toBe("armv7-ios6");
    }
  });

  test("iPad on iOS 6 maps to the armv7-ios6 native tier", () => {
    const target = resolveDeployTarget(
      device({ productType: "iPad2,1", productVersion: "6.1.3", cpuArchitecture: "armv7" }),
    );
    expect(target.kind).toBe("ios-native-tier");
    expect(target.id).toBe("armv7-ios6");
  });

  test("iOS 5 devices (iPad 1, iPhone 3GS/4) map to armv7-ios5", () => {
    for (const productType of ["iPad1,1", "iPhone2,1", "iPhone3,1"]) {
      expect(
        nativeTierForDevice(
          device({ productType, productVersion: "5.1.1", cpuArchitecture: "armv7" }),
        ),
      ).toBe("armv7-ios5");
    }
  });

  test("64-bit devices on iOS 7-10 use the 32-bit tier of their release", () => {
    const cases: [string, string][] = [
      ["7.1.2", "armv7-ios7"],
      ["8.4", "armv7-ios8"],
      ["9.3.5", "armv7-ios9"],
      ["10.3.3", "armv7-ios9"],
    ];
    for (const [productVersion, tier] of cases) {
      expect(
        nativeTierForDevice(
          device({ productType: "iPhone6,1", productVersion, cpuArchitecture: "arm64" }),
        ),
      ).toBe(tier);
    }
  });

  test("32-bit iOS 10 devices use armv7-ios9", () => {
    expect(
      nativeTierForDevice(
        device({ productType: "iPhone5,2", productVersion: "10.3.4", cpuArchitecture: "armv7s" }),
      ),
    ).toBe("armv7-ios9");
  });

  test("iPod touch 6/7 on iOS 12 use the arm64-ios12 tier", () => {
    const target = resolveDeployTarget(
      device({ productType: "iPod9,1", productVersion: "12.5.7", cpuArchitecture: "arm64" }),
    );
    expect(target.kind).toBe("ios-native-tier");
    expect(target.id).toBe("arm64-ios12");
  });

  test("below iOS 5 and ARMv6 have no tier", () => {
    expect(() =>
      nativeTierForDevice(
        device({ productType: "iPhone2,1", productVersion: "4.3.5", cpuArchitecture: "armv7" }),
      ),
    ).toThrow();
    expect(() =>
      nativeTierForDevice(
        device({ productType: "iPhone1,2", productVersion: "4.2.1", cpuArchitecture: "armv6" }),
      ),
    ).toThrow();
  });

  test("legacy stacks with a tier build through it", () => {
    expect(resolveLegacyStack("iphone4s-ios6").nativeTier).toBe("armv7-ios6");
    expect(resolveLegacyStack("ipodtouch4-ios6").nativeTier).toBe("armv7-ios6");
    expect(resolveLegacyStack("ipodtouch-ios12").nativeTier).toBe("arm64-ios12");
  });

  test("iPhone 1G on iOS 3 maps to iphone2g", () => {
    const target = resolveDeployTarget(
      device({
        productType: "iPhone1,1",
        productVersion: "3.1.3",
        cpuArchitecture: "armv6",
      }),
    );
    expect(target.id).toBe("iphone2g-ios3");
  });

  test("catalog provides per-model legacy logical sizes", () => {
    const se = lookupDeviceProfile("iPhone8,4");
    expect(se.legacyLogical).toEqual([320, 568]);
    const ipad = lookupDeviceProfile("iPad6,11");
    expect(ipad.legacyLogical).toEqual([1024, 768]);
  });

  test("nativeTierForDevice picks arm64-ios12", () => {
    expect(
      nativeTierForDevice(
        device({
          productType: "iPhone10,1",
          productVersion: "14.2",
          cpuArchitecture: "arm64",
        }),
      ),
    ).toBe("arm64-ios12");
  });
});
