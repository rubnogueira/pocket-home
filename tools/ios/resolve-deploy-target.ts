import type { UsbDeviceIdentity } from "./device-probe.ts";
import { lookupDeviceProfile } from "./device-catalog.ts";
import { listIosNativeTierIds, resolveIosNativeTier } from "../ios-native/tiers.ts";

/** Same minimum as `tools/ios-app.ts` (NativeScript modern shell). */
export const MIN_IOS_APP_VERSION = 16;

export type DeployTargetKind = "ios-app" | "ios-native-tier" | "legacy-stack";

export interface DeployTarget {
  readonly kind: DeployTargetKind;
  readonly id: string;
  readonly device: UsbDeviceIdentity;
  readonly deviceLabel: string;
  readonly legacyLogical: readonly [number, number];
  readonly usesNativeCanvas: boolean;
  readonly summary: string;
}

function iosMajorMinor(version: string): { major: number; minor: number } {
  const parts = version.split(".").map((p) => Number.parseInt(p, 10));
  return { major: parts[0] ?? 0, minor: parts[1] ?? 0 };
}

function isArm64(cpu: string): boolean {
  const normalized = cpu.toLowerCase();
  return normalized.includes("arm64") || normalized === "arm64e";
}

function resolveLegacyStack(device: UsbDeviceIdentity): string | undefined {
  const { major } = iosMajorMinor(device.productVersion);
  const type = device.productType;

  if (type === "iPhone1,1" && major === 3) return "iphone2g-ios3";
  if (type === "iPhone4,1" && major === 6) return "iphone4s-ios6";
  if (type === "iPod4,1" && major === 6) return "ipodtouch4-ios6";
  if ((type === "iPod7,1" || type === "iPod9,1") && major === 12) return "ipodtouch-ios12";

  if (major <= 6) {
    if (type.startsWith("iPod")) return "ipodtouch4-ios6";
    if (type.startsWith("iPhone")) return "iphone4s-ios6";
  }
  return undefined;
}

export function nativeTierForDevice(device: UsbDeviceIdentity): string {
  const { major } = iosMajorMinor(device.productVersion);
  const arm64 = isArm64(device.cpuArchitecture);

  if (arm64) {
    if (major >= 12) return "arm64-ios12";
    if (major >= 11) return "arm64-ios11";
    throw new Error(
      `ios-device: iOS ${device.productVersion} on ${device.cpuArchitecture} has no arm64 tier (need iOS 11+)`,
    );
  }

  if (major >= 9) return "armv7-ios9";
  if (major >= 8) return "armv7-ios8";
  if (major >= 7) return "armv7-ios7";
  throw new Error(
    `ios-device: iOS ${device.productVersion} on ${device.cpuArchitecture} needs a legacy stack, not ios-native`,
  );
}

export function resolveDeployTarget(device: UsbDeviceIdentity): DeployTarget {
  const profile = lookupDeviceProfile(device.productType);
  const legacyStack = resolveLegacyStack(device);
  const { major } = iosMajorMinor(device.productVersion);

  if (legacyStack) {
    return {
      kind: "legacy-stack",
      id: legacyStack,
      device,
      deviceLabel: profile.label,
      legacyLogical: profile.legacyLogical,
      usesNativeCanvas: false,
      summary: `${profile.label} · iOS ${device.productVersion} · legacy ${legacyStack} · canvas ${profile.legacyLogical.join("×")}`,
    };
  }

  if (major >= MIN_IOS_APP_VERSION && isArm64(device.cpuArchitecture)) {
    return {
      kind: "ios-app",
      id: "ios-app",
      device,
      deviceLabel: profile.label,
      legacyLogical: profile.legacyLogical,
      usesNativeCanvas: true,
      summary: `${profile.label} · iOS ${device.productVersion} · modern app (NativeScript, same as Simulator)`,
    };
  }

  const tierId = nativeTierForDevice(device);
  if (!listIosNativeTierIds().includes(tierId)) {
    throw new Error(
      `ios-device: resolved tier ${tierId} is not configured in hosts/ios/takeover/tiers`,
    );
  }
  resolveIosNativeTier(tierId);

  return {
    kind: "ios-native-tier",
    id: tierId,
    device,
    deviceLabel: profile.label,
    legacyLogical: profile.legacyLogical,
    usesNativeCanvas: true,
    summary: `${profile.label} · iOS ${device.productVersion} · jailbreak tier ${tierId} · UIKit takeover`,
  };
}
