import { join } from "node:path";
import { PROJECT_ROOT } from "../paths.ts";

/** All Pocket Home Apple device hosts and deploy metadata. */
export const IOS_HOST = join(PROJECT_ROOT, "hosts/ios");

/** NativeScript app (iOS 16+, Simulator or USB). */
export const IOS_APP_SHELL = join(IOS_HOST, "app");

/** Jailbreak UIKit takeover template + CPU/iOS tiers. */
export const IOS_TAKEOVER_HOST = join(IOS_HOST, "takeover");
export const IOS_TAKEOVER_TIERS = join(IOS_TAKEOVER_HOST, "tiers");

/** Legacy stack manifests (iOS 6 and earlier, …). */
export const IOS_LEGACY_STACKS_DIR = join(IOS_HOST, "legacy/stacks");

/** USB `ProductType` → label + legacy logical canvas. */
export const IOS_PRODUCT_CATALOG = join(IOS_HOST, "catalog/product-catalog.json");

/**
 * Pinned `xcodebuild -derivedDataPath` for Simulator builds of the app shell. Products land in
 * `Build/Products/<Configuration>-iphonesimulator/`; that exact `.app` is what gets installed.
 */
export const IOS_APP_SIMULATOR_DERIVED_DATA = join(
  IOS_APP_SHELL,
  "platforms/ios/build/DerivedData",
);

export function iosAppSimulatorProduct(configuration: "Debug" | "Release" = "Debug"): string {
  return join(
    IOS_APP_SIMULATOR_DERIVED_DATA,
    "Build/Products",
    `${configuration}-iphonesimulator`,
    "iossimulator.app",
  );
}
