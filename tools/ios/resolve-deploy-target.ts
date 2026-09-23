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

/**
 * Devices only a framework legacy stack can serve. Every armv7/arm64 device on iOS 5+ goes through
 * an ios-native tier instead: the takeover host lays the guest out at the screen's size in points
 * (phone or tablet, either orientation), draws with OpenGL ES and loads the guest baked for the
 * screen's density, so the per-model phone canvases of the old stacks are no longer needed.
 */
function resolveLegacyStack(device: UsbDeviceIdentity): string | undefined {
  const { major } = iosMajorMinor(device.productVersion);
  if (device.productType === "iPhone1,1" && major === 3) return "iphone2g-ios3";
  return undefined;
}

export function nativeTierForDevice(device: UsbDeviceIdentity): string {
  const { major } = iosMajorMinor(device.productVersion);
  const arm64 = isArm64(device.cpuArchitecture);

  if (arm64) {
    if (major >= 12) return "arm64-ios12";
    if (major >= 11) return "arm64-ios11";
    // iOS 7-10 on 64-bit hardware (iPhone 5s, iPad Air/mini 2...): those releases still run
    // 32-bit apps, so the armv7 tier of that release serves them.
  } else if (device.cpuArchitecture.toLowerCase().startsWith("armv6")) {
    throw new Error(
      `ios-device: ${device.productType} (${device.cpuArchitecture}) cannot run an ios-native tier: ` +
        "current toolchains no longer link ARMv6 (only the iPhone 2G has a framework stack)",
    );
  }

  if (major >= 9) return "armv7-ios9"; // 9.x and 10.x (the last 32-bit release)
  if (major >= 8) return "armv7-ios8";
  if (major >= 7) return "armv7-ios7";
  if (major >= 6) return "armv7-ios6";
  if (major >= 5) return "armv7-ios5";
  throw new Error(
    `ios-device: iOS ${device.productVersion} is below the oldest tier (iOS 5); every ARMv7 ` +
      "device can update to iOS 5 or later",
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
