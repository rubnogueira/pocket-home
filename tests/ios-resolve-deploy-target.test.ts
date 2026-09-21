import { describe, expect, test } from "bun:test";
import type { UsbDeviceIdentity } from "../tools/ios/device-probe.ts";
import { lookupDeviceProfile } from "../tools/ios/device-catalog.ts";
import { nativeTierForDevice, resolveDeployTarget } from "../tools/ios/resolve-deploy-target.ts";

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

  test("iPhone 4S on iOS 6 maps to legacy stack", () => {
    const target = resolveDeployTarget(
      device({
        productType: "iPhone4,1",
        productVersion: "6.1.3",
        cpuArchitecture: "armv7",
      }),
    );
    expect(target.kind).toBe("legacy-stack");
    expect(target.id).toBe("iphone4s-ios6");
    expect(target.usesNativeCanvas).toBe(false);
    expect(target.legacyLogical).toEqual([320, 480]);
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
