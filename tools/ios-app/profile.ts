import {
  POCKET_CAPABILITIES,
  definePlatformContractRegistry,
  defineTargetRegistry,
  type Viewport,
} from "../../node_modules/@pocketjs/framework/contracts/spec/platforms.ts";
import { validateAndResolveBuildPlan } from "@pocketjs/framework/manifest";
import type { ResolvedBuildPlan } from "../../node_modules/@pocketjs/framework/framework/src/manifest/plan.ts";
import { manifestLogicalViewport } from "../ios/viewport.ts";
import { iosShellLogicalViewports } from "./admissible-viewports.ts";
import {
  IOS_APP_DEFAULT_DENSITY,
  IOS_APP_HOST_ABI,
  IOS_APP_MAX_DENSITY,
  IOS_APP_TARGET_ID,
} from "./constants.ts";

/**
 * Pocket Home ios-dev plan: same target id / hostAbi as framework `resolveIOSDevBuildPlan`,
 * but logical viewport comes from `pocket.json` plus admissible runtime sizes (not fixed 480×272).
 */
export function iosAppContracts(logical: Viewport, rasterDensity: number) {
  if (
    !Number.isInteger(rasterDensity) ||
    rasterDensity < 1 ||
    rasterDensity > IOS_APP_MAX_DENSITY
  ) {
    throw new Error(
      `ios-app: raster density must be an integer 1..${IOS_APP_MAX_DENSITY}, got ${rasterDensity}`,
    );
  }
  const physical: Viewport = [logical[0] * rasterDensity, logical[1] * rasterDensity];
  const logicalViewports = iosShellLogicalViewports(logical);
  return definePlatformContractRegistry(
    POCKET_CAPABILITIES,
    defineTargetRegistry({
      [IOS_APP_TARGET_ID]: {
        hostAbi: IOS_APP_HOST_ABI,
        platform: "ios",
        form: "embedded",
        display: {
          physicalViewport: physical,
          logicalViewports,
          presentations: ["native", "integer-fit", "stretch"],
          rasterDensity,
        },
        capabilities: [
          "input.touch",
          "input.buttons",
          "text.glyphs.baked",
          "net.http",
          "display.viewport.live",
        ],
      },
    }),
  );
}

export function resolveIosAppBuildPlan(
  manifestInput: unknown,
  rasterDensity: number = IOS_APP_DEFAULT_DENSITY,
): ResolvedBuildPlan {
  const logical = manifestLogicalViewport(manifestInput);
  const resolution = validateAndResolveBuildPlan(
    manifestInput,
    { target: IOS_APP_TARGET_ID },
    iosAppContracts(logical, rasterDensity),
  );
  if (!resolution.ok) {
    throw new Error(
      `ios-app: manifest did not resolve: ${resolution.diagnostics
        .map((d) => `${d.path || "/"}: ${d.message}`)
        .join("; ")}`,
    );
  }
  return resolution.plan;
}

export {
  IOS_APP_DEFAULT_DENSITY,
  IOS_APP_HOST_ABI,
  IOS_APP_MAX_DENSITY,
  IOS_APP_TARGET_ID,
} from "./constants.ts";
