import {
  POCKET_CAPABILITIES,
  definePlatformContractRegistry,
  defineTargetRegistry,
  type Viewport,
} from "../../node_modules/@pocketjs/framework/contracts/spec/platforms.ts";
import { validateAndResolveBuildPlan } from "@pocketjs/framework/manifest";
import type { ResolvedBuildPlan } from "../../node_modules/@pocketjs/framework/framework/src/manifest/plan.ts";
import {
  IPHONE2G_DEV_HOST_ABI,
  IPHONE2G_DEV_TARGET_ID,
  IPHONE2G_VIEWPORT,
} from "../../node_modules/@pocketjs/framework/tools/iphone2g-profile.ts";
import {
  IPHONE4S_DEV_HOST_ABI,
  IPHONE4S_DEV_TARGET_ID,
  IPHONE4S_PHYSICAL_VIEWPORT,
  IPHONE4S_RASTER_DENSITY,
} from "../../node_modules/@pocketjs/framework/tools/iphone4s-profile.ts";
import {
  IPODTOUCH4_DEV_HOST_ABI,
  IPODTOUCH4_DEV_TARGET_ID,
  IPODTOUCH4_PHYSICAL_VIEWPORT,
  IPODTOUCH4_RASTER_DENSITY,
} from "../../node_modules/@pocketjs/framework/tools/ipodtouch4-profile.ts";
import {
  IPODTOUCH_DEV_HOST_ABI,
  IPODTOUCH_DEV_TARGET_ID,
  IPODTOUCH_PHYSICAL_VIEWPORT,
  IPODTOUCH_RASTER_DENSITY,
} from "../../node_modules/@pocketjs/framework/tools/ipodtouch-profile.ts";

function withViewport(
  targetId: string,
  hostAbi: number,
  logical: Viewport,
  physical: Viewport,
  density: number,
  capabilities: readonly (
    | "input.touch"
    | "input.buttons"
    | "text.glyphs.baked"
    | "net.http"
    | "io.offload"
  )[],
) {
  return definePlatformContractRegistry(
    POCKET_CAPABILITIES,
    defineTargetRegistry({
      [targetId]: {
        hostAbi,
        platform: "ios",
        form: "takeover",
        display: {
          physicalViewport: physical,
          logicalViewports: [logical],
          presentations: ["native"],
          rasterDensity: density,
        },
        capabilities,
      },
    }),
  );
}

export function resolveLegacyIPhone2GPlan(manifest: unknown): ResolvedBuildPlan {
  const logical: Viewport = [IPHONE2G_VIEWPORT[0], IPHONE2G_VIEWPORT[1]];
  const resolution = validateAndResolveBuildPlan(
    manifest,
    { target: IPHONE2G_DEV_TARGET_ID },
    withViewport(IPHONE2G_DEV_TARGET_ID, IPHONE2G_DEV_HOST_ABI, logical, logical, 1, [
      "input.touch",
      "input.buttons",
      "text.glyphs.baked",
      "net.http",
    ]),
  );
  if (!resolution.ok) throw planError("iphone2g", resolution.diagnostics);
  return resolution.plan;
}

export function resolveLegacyIPhone4SPlan(manifest: unknown): ResolvedBuildPlan {
  const logical: Viewport = [320, 480];
  const resolution = validateAndResolveBuildPlan(
    manifest,
    { target: IPHONE4S_DEV_TARGET_ID },
    withViewport(
      IPHONE4S_DEV_TARGET_ID,
      IPHONE4S_DEV_HOST_ABI,
      logical,
      IPHONE4S_PHYSICAL_VIEWPORT,
      IPHONE4S_RASTER_DENSITY,
      ["input.touch", "input.buttons", "text.glyphs.baked", "net.http"],
    ),
  );
  if (!resolution.ok) throw planError("iphone4s", resolution.diagnostics);
  return resolution.plan;
}

export function resolveLegacyIPodTouch4Plan(manifest: unknown): ResolvedBuildPlan {
  const logical: Viewport = [320, 480];
  const resolution = validateAndResolveBuildPlan(
    manifest,
    { target: IPODTOUCH4_DEV_TARGET_ID },
    withViewport(
      IPODTOUCH4_DEV_TARGET_ID,
      IPODTOUCH4_DEV_HOST_ABI,
      logical,
      IPODTOUCH4_PHYSICAL_VIEWPORT,
      IPODTOUCH4_RASTER_DENSITY,
      ["input.touch", "input.buttons", "text.glyphs.baked", "net.http", "io.offload"],
    ),
  );
  if (!resolution.ok) throw planError("ipodtouch4", resolution.diagnostics);
  return resolution.plan;
}

export function resolveLegacyIPodTouchPlan(manifest: unknown): ResolvedBuildPlan {
  const logical: Viewport = [320, 568];
  const resolution = validateAndResolveBuildPlan(
    manifest,
    { target: IPODTOUCH_DEV_TARGET_ID },
    withViewport(
      IPODTOUCH_DEV_TARGET_ID,
      IPODTOUCH_DEV_HOST_ABI,
      logical,
      IPODTOUCH_PHYSICAL_VIEWPORT,
      IPODTOUCH_RASTER_DENSITY,
      ["input.touch", "input.buttons", "text.glyphs.baked", "net.http"],
    ),
  );
  if (!resolution.ok) throw planError("ipodtouch", resolution.diagnostics);
  return resolution.plan;
}

function planError(
  name: string,
  diagnostics: ReadonlyArray<{ path?: string; message: string }>,
): Error {
  return new Error(
    `ios-legacy ${name}: ${diagnostics.map((d) => `${d.path || "/"}: ${d.message}`).join("; ")}`,
  );
}

export type LegacyProfileId = "iphone2g" | "iphone4s" | "ipodtouch4" | "ipodtouch";

export function resolveLegacyPlan(manifest: unknown, profile: LegacyProfileId): ResolvedBuildPlan {
  switch (profile) {
    case "iphone2g":
      return resolveLegacyIPhone2GPlan(manifest);
    case "iphone4s":
      return resolveLegacyIPhone4SPlan(manifest);
    case "ipodtouch4":
      return resolveLegacyIPodTouch4Plan(manifest);
    case "ipodtouch":
      return resolveLegacyIPodTouchPlan(manifest);
    default:
      throw new Error(`ios-legacy: unknown profile ${profile satisfies never}`);
  }
}
