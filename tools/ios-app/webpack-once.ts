import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { IOS_APP_SHELL } from "../ios/paths.ts";
import { syncStagedPocketIntoPlatformApp } from "./sync-native-app.ts";

const SHELL_DIR = IOS_APP_SHELL;
const WEBPACK_BIN = join(SHELL_DIR, "node_modules/@nativescript/webpack/dist/bin/index.js");
const WEBPACK_CONFIG = join(SHELL_DIR, "webpack.config.js");
const NS_NODE = process.env.POCKET_NS_NODE ?? "node";

/** Env var for patch-nativescript-bundler — skip NS webpack when Pocket Home already built JS. */
export const POCKET_IOS_WEBPACK_DONE = "POCKET_IOS_WEBPACK_DONE";

/** Matches `hosts/ios/app/nativescript.config.ts` + NS `buildEnvData` defaults for debug iOS builds. */
function webpackEnvData(): Record<string, string | boolean | string[]> {
  return {
    ios: true,
    appId: "dev.pocket-home.dashboard",
    appPath: "src",
    appResourcesPath: "App_Resources",
    appName: "iossimulator",
    nativescriptLibPath: join(SHELL_DIR, "node_modules/nativescript/lib/nativescript-cli-lib.js"),
    sourceMap: true,
    report: false,
    hiddenSourceMap: false,
    verbose: false,
    stats: true,
    production: false,
    externals: ["~/package.json", "package.json"],
  };
}

function webpackCliArgs(envData: Record<string, string | boolean | string[]>): string[] {
  const args: string[] = ["build", `--config=${WEBPACK_CONFIG}`];
  for (const [key, value] of Object.entries(envData)) {
    if (value === undefined) continue;
    if (typeof value === "boolean") {
      if (value) args.push(`--env.${key}`);
      continue;
    }
    if (Array.isArray(value)) {
      for (const item of value) args.push(`--env.${key}=${item}`);
      continue;
    }
    args.push(`--env.${key}=${value}`);
  }
  return args;
}

interface CommandResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

async function spawn(
  command: string,
  args: readonly string[],
  env: Record<string, string | undefined>,
): Promise<CommandResult> {
  const child = Bun.spawn({
    cmd: [command, ...args],
    cwd: SHELL_DIR,
    env,
    stdout: "inherit",
    stderr: "inherit",
    stdin: "ignore",
  });
  const exitCode = await child.exited;
  return { exitCode, stdout: "", stderr: "" };
}

/**
 * `ns prepare` writes `app/package.json` (`main: "bundle"` + runtime identity) after webpack.
 * This one-shot path skips prepare, so write it the same way — without it the runtime aborts at
 * boot with "The specified module does not exist: …/iossimulator.app/app".
 */
function writeRuntimePackageJson(): void {
  const shellPackage = JSON.parse(readFileSync(join(SHELL_DIR, "package.json"), "utf8")) as {
    name: string;
  };
  const runtimePackageName = "@nativescript/ios-quickjs";
  const runtimePackagePath = join(SHELL_DIR, "node_modules", runtimePackageName, "package.json");
  const runtimeVersion = existsSync(runtimePackagePath)
    ? (JSON.parse(readFileSync(runtimePackagePath, "utf8")) as { version: string }).version
    : undefined;
  const packageData = {
    name: shellPackage.name,
    id: "dev.pocket-home.dashboard",
    ios: {
      runtimePackageName,
      ...(runtimeVersion ? { runtime: { version: runtimeVersion } } : {}),
    },
    main: "bundle",
  };
  writeFileSync(
    join(SHELL_DIR, "platforms/ios/iossimulator/app/package.json"),
    JSON.stringify(packageData, null, 2) + "\n",
  );
}

/** Webpack copy rules miss some staged pocket assets (notably `.pak`); mirror `src/assets/pocket` into the NS app folder. */
function syncStagedPocketAssetsToPlatformApp(): void {
  syncStagedPocketIntoPlatformApp();
}

/** One-shot webpack into `platforms/ios/.../app/` — patched bin exits so NS prepare is not blocked. */
export async function runIosWebpackOnce(nsEnv: Record<string, string | undefined>): Promise<void> {
  if (!existsSync(WEBPACK_BIN)) {
    throw new Error("ios-app: @nativescript/webpack missing — run bun install in hosts/ios/app");
  }
  const envData = webpackEnvData();
  const childEnv: Record<string, string | undefined> = {
    ...nsEnv,
    NATIVESCRIPT_WEBPACK_ENV: JSON.stringify(envData),
    NATIVESCRIPT_BUNDLER_ENV: JSON.stringify(envData),
  };
  delete childEnv.NODE_OPTIONS;

  console.log("ios-app: webpack (JS bundle for iOS)…");
  const result = await spawn(NS_NODE, [WEBPACK_BIN, ...webpackCliArgs(envData)], childEnv);
  if (result.exitCode !== 0) {
    throw new Error("ios-app: webpack build failed");
  }
  syncStagedPocketAssetsToPlatformApp();
  writeRuntimePackageJson();
  const bundleJs = join(SHELL_DIR, "platforms/ios", "iossimulator/app/bundle.js");
  if (!existsSync(bundleJs)) {
    throw new Error(`ios-app: webpack did not produce ${bundleJs}`);
  }
}
