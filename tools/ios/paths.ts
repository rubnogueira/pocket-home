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
