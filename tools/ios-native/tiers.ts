import { iosNativeTiers, type IosNativeTier } from "./load-tiers.ts";

export type { IosNativeTier };

export const IOS_NATIVE_TIERS = iosNativeTiers();

export const DEFAULT_IOS_NATIVE_TIER = "armv7-ios9";

export function listIosNativeTierIds(): string[] {
  return Object.keys(IOS_NATIVE_TIERS).sort();
}

export function resolveIosNativeTier(id?: string): IosNativeTier {
  const tiers = IOS_NATIVE_TIERS;
  const tierId = (id ?? process.env.POCKET_IOS_TIER ?? DEFAULT_IOS_NATIVE_TIER).trim();
  const tier = tiers[tierId];
  if (!tier) {
    throw new Error(
      `unknown iOS native tier "${tierId}" — choose one of: ${listIosNativeTierIds().join(", ")} ` +
        "(or set POCKET_IOS_TIER)",
    );
  }
  return tier;
}
