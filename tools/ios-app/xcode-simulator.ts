import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  IOS_APP_SHELL,
  IOS_APP_SIMULATOR_DERIVED_DATA,
  iosAppSimulatorProduct,
} from "../ios/paths.ts";
import {
  syncPlatformAppIntoBuiltBundle,
  syncStagedPocketIntoPlatformApp,
} from "./sync-native-app.ts";

const SHELL_DIR = IOS_APP_SHELL;
const PROJECT_NAME = "iossimulator";
const BUNDLE_ID = "dev.pocket-home.dashboard";
const PBXPROJ = join(SHELL_DIR, "platforms/ios", `${PROJECT_NAME}.xcodeproj`);
/**
 * Pinned DerivedData root. Without `-derivedDataPath`, xcodebuild writes products to
 * ~/Library/Developer/Xcode/DerivedData/<hash>/ while a stale copy under platforms/ios/build
 * got installed — native (Swift/ObjC) edits silently never reached the Simulator.
 */
const DERIVED_DATA = IOS_APP_SIMULATOR_DERIVED_DATA;
const APP_PATH = iosAppSimulatorProduct("Debug");

interface CommandResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

async function spawn(
  command: string,
  args: readonly string[],
  options: { cwd?: string; inherit?: boolean } = {},
): Promise<CommandResult> {
  const child = Bun.spawn({
    cmd: [command, ...args],
    cwd: options.cwd ?? SHELL_DIR,
    stdout: options.inherit ? "inherit" : "pipe",
    stderr: options.inherit ? "inherit" : "pipe",
    stdin: "ignore",
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    options.inherit ? Promise.resolve("") : new Response(child.stdout as ReadableStream).text(),
    options.inherit ? Promise.resolve("") : new Response(child.stderr as ReadableStream).text(),
  ]);
  return { exitCode, stdout, stderr };
}

export async function buildIosSimulatorApp(udid: string, release: boolean): Promise<string> {
  if (!existsSync(PBXPROJ)) {
    throw new Error(
      "ios-app: missing Xcode project — run `bun tools/ios-app.ts doctor` or `ns prepare ios` once",
    );
  }
  const configuration = release ? "Release" : "Debug";
  const appPath = iosAppSimulatorProduct(configuration);

  syncStagedPocketIntoPlatformApp();
  console.log(`ios-app: xcodebuild (${configuration}, Simulator ${udid.slice(0, 8)}…)…`);
  const args = [
    "-project",
    join("platforms/ios", `${PROJECT_NAME}.xcodeproj`),
    "-scheme",
    PROJECT_NAME,
    "-configuration",
    configuration,
    "-sdk",
    "iphonesimulator",
    "-destination",
    `platform=iOS Simulator,id=${udid}`,
    "-derivedDataPath",
    DERIVED_DATA,
    "CODE_SIGN_IDENTITY=",
    "ONLY_ACTIVE_ARCH=YES",
    "build",
  ];
  const built = await spawn("xcodebuild", args, { inherit: true });
  if (built.exitCode !== 0) {
    throw new Error("ios-app: xcodebuild failed");
  }
  if (!existsSync(appPath)) {
    throw new Error(`ios-app: expected ${appPath} after xcodebuild`);
  }
  console.log("ios-app: syncing webpack app/ tree into .app bundle…");
  syncPlatformAppIntoBuiltBundle(appPath);
  return appPath;
}

export async function installAndLaunchSimulatorApp(
  udid: string,
  appPath: string,
  attach: boolean,
): Promise<void> {
  console.log("ios-app: installing on Simulator…");
  const install = await spawn("xcrun", ["simctl", "install", udid, appPath]);
  if (install.exitCode !== 0) {
    throw new Error(`ios-app: simctl install failed:\n${install.stderr}`);
  }
  console.log(`ios-app: launching ${BUNDLE_ID}…`);
  const launch = await spawn("xcrun", ["simctl", "launch", udid, BUNDLE_ID], { inherit: attach });
  if (launch.exitCode !== 0) {
    throw new Error(`ios-app: simctl launch failed:\n${launch.stderr}`);
  }
  if (!attach && launch.stdout) {
    console.log(launch.stdout.trim());
  }
}

/** Default output path when reusing an existing build without rebuilding. */
export function defaultSimulatorAppPath(release: boolean): string {
  return iosAppSimulatorProduct(release ? "Release" : "Debug");
}

export { BUNDLE_ID, APP_PATH };
