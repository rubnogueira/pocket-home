/** PocketJS `ios-dev` identity — same target as `@nativescript/pocketjs` / `tools/ios-profile.ts`. */
export {
  IOS_DEV_HOST_ABI as IOS_APP_HOST_ABI,
  IOS_DEV_MAX_DENSITY as IOS_APP_MAX_DENSITY,
  IOS_DEV_TARGET_ID as IOS_APP_TARGET_ID,
} from "../../node_modules/@pocketjs/framework/tools/ios-profile.ts";

/** Default when a single density is requested without --density. */
export const IOS_APP_DEFAULT_DENSITY = 2;
/**
 * Densities staged by default. The shell picks ceil(screen scale x surface stretch) per device:
 * 3 on 3x iPhones and on iPads (2x screen, surface stretched ~1.18x to keep touch in range), 2
 * on 2x iPhones.
 */
export const IOS_APP_DENSITIES = [2, 3] as const;

/** Matches `tools/ios.ts` tick rates for ios-dev guests. Both are staged; the shell runs 120
 *  on ProMotion screens (UIScreen.maximumFramesPerSecond >= 120), 60 elsewhere. */
export const IOS_APP_TICK_RATES = [60, 120] as const;
export const IOS_APP_DEFAULT_TICK_HZ = 60;

export const IOS_APP_MIN_RUNTIME = 16;
