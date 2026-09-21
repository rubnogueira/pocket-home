/** PocketJS `ios-dev` identity — same target as `@nativescript/pocketjs` / `tools/ios-profile.ts`. */
export {
  IOS_DEV_HOST_ABI as IOS_APP_HOST_ABI,
  IOS_DEV_MAX_DENSITY as IOS_APP_MAX_DENSITY,
  IOS_DEV_TARGET_ID as IOS_APP_TARGET_ID,
} from "../../node_modules/@pocketjs/framework/tools/ios-profile.ts";

/** Dashboard default (framework demo shell uses density 3). */
export const IOS_APP_DEFAULT_DENSITY = 2;

/** Matches `tools/ios.ts` tick rates for ios-dev guests. */
export const IOS_APP_TICK_RATES = [60, 120] as const;
export const IOS_APP_DEFAULT_TICK_HZ = 60;

export const IOS_APP_MIN_RUNTIME = 16;
