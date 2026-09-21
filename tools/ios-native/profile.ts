import {
  POCKET_CAPABILITIES,
  definePlatformContractRegistry,
  defineTargetRegistry,
  type Viewport,
} from "../../node_modules/@pocketjs/framework/contracts/spec/platforms.ts";
import { validateAndResolveBuildPlan } from "@pocketjs/framework/manifest";
import type { ResolvedBuildPlan } from "../../node_modules/@pocketjs/framework/framework/src/manifest/plan.ts";
import { manifestLogicalViewport } from "../ios/viewport.ts";
import type { IosNativeTier } from "./tiers.ts";
import { resolveIosNativeTier } from "./tiers.ts";

export function contractsForTier(tier: IosNativeTier, logical: Viewport) {
  const density = tier.defaultRasterDensity;
  const physical: Viewport = [logical[0] * density, logical[1] * density];
  return definePlatformContractRegistry(
    POCKET_CAPABILITIES,
    defineTargetRegistry({
      [tier.targetId]: {
        hostAbi: tier.hostAbi,
        platform: "ios",
        form: "takeover",
        display: {
          physicalViewport: physical,
          logicalViewports: [logical],
          presentations: ["native"],
          rasterDensity: density,
        },
        capabilities: ["input.touch", "input.buttons", "text.glyphs.baked", "net.http"],
      },
    }),
  );
}

export function resolveIosNativeBuildPlan(
  manifestInput: unknown,
  tierId?: string,
): ResolvedBuildPlan {
  const tier = resolveIosNativeTier(tierId);
  const logical = manifestLogicalViewport(manifestInput);
  const resolution = validateAndResolveBuildPlan(
    manifestInput,
    { target: tier.targetId },
    contractsForTier(tier, logical),
  );
  if (!resolution.ok) {
    throw new Error(
      `ios-native: manifest did not resolve for tier ${tier.id}: ${resolution.diagnostics
        .map((d) => `${d.path || "/"}: ${d.message}`)
        .join("; ")}`,
    );
  }
  return resolution.plan;
}
