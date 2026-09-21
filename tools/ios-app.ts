// Modern iOS / iPadOS (iOS 16+) — NativeScript shell; same app on Simulator or USB device.
//
// Guest build/staging follows `@pocketjs/framework/tools/ios.ts` (ios-dev / PocketApple via
// `@nativescript/pocketjs`). Pocket Home adds pocket.json viewport, dashboard shell glue, USB
// launch, and Bun/Ruby NS wrappers — see hosts/ios/app/README.md.
//
//   bun tools/ios-app.ts doctor|devices|build|run
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { extractHostBuildInputs } from "@pocketjs/framework/manifest";
import { PROJECT_ROOT } from "./paths.ts";
import { ensureIosAppShell } from "./ensure-ios-app-shell.ts";
import { iosAppRubyEnv } from "./ensure-ios-ruby.ts";
import { IOS_APP_SHELL } from "./ios/paths.ts";
import {
  IOS_APP_DEFAULT_DENSITY,
  IOS_APP_DEFAULT_TICK_HZ,
  IOS_APP_MAX_DENSITY,
  IOS_APP_MIN_RUNTIME,
  IOS_APP_TARGET_ID,
  IOS_APP_TICK_RATES,
} from "./ios-app/constants.ts";
import { resolveIosAppBuildPlan } from "./ios-app/profile.ts";
import { admissibleIosAppSimulators, pickIosAppSimulator } from "./ios-app/simulators.ts";
import { stageGuestIntoShell } from "./ios-app/stage-guest.ts";
import { POCKET_IOS_WEBPACK_DONE, runIosWebpackOnce } from "./ios-app/webpack-once.ts";
import { mergeIosPluginsXcconfig } from "./ios-app/merge-xcconfig.ts";
import { diagnoseIosAppStaging } from "./ios-app/sync-native-app.ts";
import { buildIosSimulatorApp, installAndLaunchSimulatorApp } from "./ios-app/xcode-simulator.ts";

const SHELL_DIR = IOS_APP_SHELL;
/** NativeScript CLI entry — not `bin/tns` (may be shimmed to pocket-ns). */
const TNS_CLI = join(SHELL_DIR, "node_modules/nativescript/lib/nativescript-cli.js");
/** Must match `projectName` in hosts/ios/app/nativescript.config.ts (NativeScript `${projectName}.xcodeproj`). */
const IOS_NS_PROJECT_NAME = "iossimulator";
const SWIFTUI_BOOT_FLAG = "NS_SWIFTUI_BOOT = 1";
const POCKET_SURFACE_PATCH = "PocketSurfaceView+PocketHome.m";
const NS_NODE = process.env.POCKET_NS_NODE ?? "node";
const RUBY_SHIM_DIR = join(SHELL_DIR, "tools/ruby-shim");

let cachedNsEnv: Record<string, string | undefined> | undefined;

/** Env for NativeScript CLI — ruby-shim + GEM_PATH only (no NODE_OPTIONS; breaks NS cleanup + webpack). */
function nativeScriptEnv(
  extra: Record<string, string | undefined> = {},
): Record<string, string | undefined> {
  if (!cachedNsEnv) {
    const pathPrefix = `${RUBY_SHIM_DIR}${process.env.PATH ? `:${process.env.PATH}` : ""}`;
    cachedNsEnv = {
      ...process.env,
      ...iosAppRubyEnv(),
      PATH: pathPrefix,
    };
    delete cachedNsEnv.NODE_OPTIONS;
  }
  return { ...cachedNsEnv, ...extra };
}

async function spawnNativeScript(
  args: readonly string[],
  extraEnv: Record<string, string | undefined> = {},
): Promise<CommandResult> {
  if (!existsSync(TNS_CLI)) {
    throw new Error("ios-app: nativescript not installed — run bun install in hosts/ios/app");
  }
  return spawnAsync(NS_NODE, [TNS_CLI, ...args], {
    cwd: SHELL_DIR,
    inherit: true,
    env: nativeScriptEnv(extraEnv),
  });
}

function iosNativePlatformPbxproj(): string {
  return join(SHELL_DIR, "platforms/ios", `${IOS_NS_PROJECT_NAME}.xcodeproj/project.pbxproj`);
}

async function ensureIosNativeScriptPlatform(): Promise<void> {
  if (existsSync(iosNativePlatformPbxproj())) {
    return;
  }
  console.log("ios-app: NativeScript iOS platform missing — running `ns prepare ios`…");
  const prepared = await spawnNativeScript(["prepare", "ios"]);
  if (prepared.exitCode !== 0) {
    throw new Error("ios-app: ns prepare ios failed");
  }
  if (!existsSync(iosNativePlatformPbxproj())) {
    throw new Error(
      `ios-app: expected ${iosNativePlatformPbxproj()} after prepare — check NativeScript / Xcode`,
    );
  }
}

/** Ensures App_Resources native patches are compiled into the Xcode target (survives `ns prepare`). */
function ensurePocketHomeNativeSourcesInXcodeProject(): void {
  const pbxPath = iosNativePlatformPbxproj();
  if (!existsSync(pbxPath)) {
    return;
  }
  let text = readFileSync(pbxPath, "utf8");
  if (text.includes(POCKET_SURFACE_PATCH)) {
    return;
  }
  const fileRefId = "C8F4A2B91E3D4F5A9B0C1D2E3";
  const buildFileId = "D9E5B3C02F4E5A6B0C1D2E3F4";
  text = text.replace(
    /(\t\tE1A36500DDAD4CE19C5750B8 \/\* PocketEmbedPresenter\.swift \*\/,\n)/,
    `$1\t\t${fileRefId} /* ${POCKET_SURFACE_PATCH} */,\n`,
  );
  text = text.replace(
    /(\/\* Begin PBXBuildFile section \*\/\n)/,
    `$1\t\t${buildFileId} /* ${POCKET_SURFACE_PATCH} in Sources */ = {isa = PBXBuildFile; fileRef = ${fileRefId} /* ${POCKET_SURFACE_PATCH} */; };\n`,
  );
  text = text.replace(
    /(\/\* Begin PBXFileReference section \*\/\n)/,
    `$1\t\t${fileRefId} /* ${POCKET_SURFACE_PATCH} */ = {isa = PBXFileReference; name = "${POCKET_SURFACE_PATCH}"; path = "../../App_Resources/iOS/src/${POCKET_SURFACE_PATCH}"; sourceTree = "<group>"; fileEncoding = 4; lastKnownFileType = sourcecode.c.objc; explicitFileType = undefined; includeInIndex = 0; };\n`,
  );
  text = text.replace(
    /(\t\t\t\t9BB8FC78314047A1B995F6F2 \/\* PocketEmbedPresenter\.swift in Sources \*\/,\n)/,
    `$1\t\t\t\t${buildFileId} /* ${POCKET_SURFACE_PATCH} in Sources */,\n`,
  );
  writeFileSync(pbxPath, text);
}

/** NativeScript merges App_Resources/build.xcconfig into plugins-*.xcconfig via Ruby xcodeproj. */
function ensureSwiftUiBootInPlatformXcconfigs(): void {
  const resourcesBuild = join(
    SHELL_DIR,
    "platforms/ios",
    `${IOS_NS_PROJECT_NAME}/Resources/build.xcconfig`,
  );
  if (existsSync(resourcesBuild)) {
    let text = readFileSync(resourcesBuild, "utf8");
    if (!text.includes("NS_SWIFTUI_BOOT")) {
      const lines = text.split("\n");
      const insertAt = lines.findIndex((l) => l.startsWith("IPHONEOS_DEPLOYMENT_TARGET"));
      const line = insertAt >= 0 ? insertAt + 1 : 2;
      lines.splice(line, 0, SWIFTUI_BOOT_FLAG);
      writeFileSync(resourcesBuild, lines.join("\n"));
    }
  }
  for (const rel of [
    "platforms/ios/plugins-debug.xcconfig",
    "platforms/ios/plugins-release.xcconfig",
  ]) {
    const path = join(SHELL_DIR, rel);
    if (!existsSync(path)) continue;
    let text = readFileSync(path, "utf8");
    if (text.trim().length === 0 || !text.includes("ASSETCATALOG_COMPILER_APPICON_NAME")) {
      text = [
        "ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;",
        `CODE_SIGN_ENTITLEMENTS = ${IOS_NS_PROJECT_NAME}/${IOS_NS_PROJECT_NAME}.entitlements`,
        "EXCLUDED_ARCHS[sdk=iphonesimulator*] = i386 armv6 armv7 armv7s armv8 x86_64",
        "IPHONEOS_DEPLOYMENT_TARGET = 16.0;",
        SWIFTUI_BOOT_FLAG,
        "",
      ].join("\n");
    } else if (!text.includes("NS_SWIFTUI_BOOT")) {
      text = `${text.trimEnd()}\n${SWIFTUI_BOOT_FLAG}\n`;
    } else {
      text = text.replace(/NS_SWIFTUI_BOOT\s*=\s*\d+/, SWIFTUI_BOOT_FLAG);
    }
    writeFileSync(path, text);
  }
}

const PLAN_PATH = join(PROJECT_ROOT, ".pocket/ios-app/pocket-home.plan.json");
const GUEST_DIR = join(PROJECT_ROOT, "dist/ios-app/guest");
const STAMP_PATH = join(PROJECT_ROOT, "dist/ios-app/build-stamp.json");
const DEFAULT_TICK_HZ = IOS_APP_DEFAULT_TICK_HZ;

interface CommandResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

interface BuildStamp {
  readonly tickHz: number;
  readonly density: number;
}

interface GuestArtifacts {
  readonly appOutput: string;
  readonly bundle: string;
  readonly pak: string;
  readonly planPath: string;
}

function run(
  executable: string,
  args: readonly string[],
  options: {
    cwd?: string;
    inherit?: boolean;
    env?: Record<string, string | undefined>;
  } = {},
): CommandResult {
  const result = Bun.spawnSync({
    cmd: [executable, ...args],
    cwd: options.cwd ?? PROJECT_ROOT,
    env: options.env ?? process.env,
    stdout: options.inherit ? "inherit" : "pipe",
    stderr: options.inherit ? "inherit" : "pipe",
  });
  return {
    exitCode: result.exitCode,
    stdout: options.inherit ? "" : (result.stdout?.toString() ?? ""),
    stderr: options.inherit ? "" : (result.stderr?.toString() ?? ""),
  };
}

function mustRun(
  executable: string,
  args: readonly string[],
  options: { cwd?: string; inherit?: boolean } = {},
): string {
  const result = run(executable, args, options);
  if (result.exitCode !== 0) {
    const detail = [result.stdout.trim(), result.stderr.trim()].filter(Boolean).join("\n");
    throw new Error(
      `ios-app: ${executable} ${args.join(" ")} failed (${result.exitCode})${
        detail ? `:\n${detail}` : ""
      }`,
    );
  }
  return result.stdout.trim();
}

function flagValue(args: readonly string[], name: string): string | undefined {
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function tickRateFlag(args: readonly string[]): number | undefined {
  const raw = flagValue(args, "--hz");
  if (raw === undefined) return undefined;
  const hz = Number(raw);
  if (!IOS_APP_TICK_RATES.includes(hz as (typeof IOS_APP_TICK_RATES)[number])) {
    throw new Error(`ios-app: --hz wants ${IOS_APP_TICK_RATES.join(" or ")}`);
  }
  return hz;
}

function densityFlag(args: readonly string[]): number {
  const raw = flagValue(args, "--density");
  const density = Number(raw ?? IOS_APP_DEFAULT_DENSITY);
  if (!Number.isInteger(density) || density < 1 || density > IOS_APP_MAX_DENSITY) {
    throw new Error(`ios-app: --density must be an integer 1..${IOS_APP_MAX_DENSITY}`);
  }
  return density;
}

function manifestPath(): string {
  return join(PROJECT_ROOT, "pocket.json");
}

async function spawnAsync(
  command: string,
  args: readonly string[],
  options: { cwd?: string; inherit?: boolean; env?: Record<string, string | undefined> } = {},
): Promise<CommandResult> {
  const child = Bun.spawn({
    cmd: [command, ...args],
    cwd: options.cwd ?? PROJECT_ROOT,
    env: options.env ?? process.env,
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

async function ensureSimulatorReady(simulator: { udid: string; state: string }): Promise<void> {
  if (simulator.state === "Booted") {
    return;
  }
  console.log("ios-app: booting Simulator…");
  const boot = await spawnAsync("xcrun", ["simctl", "boot", simulator.udid], { inherit: false });
  const combined = `${boot.stdout}\n${boot.stderr}`.trim();
  if (
    boot.exitCode !== 0 &&
    !/current state: Booted/i.test(combined) &&
    !/Unable to boot device in current state: Booted/i.test(combined)
  ) {
    throw new Error(
      `ios-app: simctl boot failed (${boot.exitCode})${combined ? `:\n${combined}` : ""}`,
    );
  }
  await spawnAsync("open", ["-a", "Simulator", "--args", "-CurrentDeviceUDID", simulator.udid]);
}

function check(label: string, ok: boolean, detail?: string): boolean {
  console.log(`  [${ok ? "ok" : "missing"}] ${label}${detail ? `: ${detail}` : ""}`);
  return ok;
}

async function doctor(): Promise<void> {
  console.log("Pocket Home iOS app (Simulator or device)\n");
  let ok = true;
  const arm64Host = run("uname", ["-m"]).stdout.trim() === "arm64";
  ok =
    check(
      "Apple Silicon host",
      arm64Host,
      arm64Host ? undefined : "NativeScript iOS runtime ships arm64 simulator slices only",
    ) && ok;
  ok = check("Xcode xcrun", run("xcrun", ["--find", "clang"]).exitCode === 0) && ok;
  const simulators = await admissibleIosAppSimulators();
  ok =
    check(
      `iOS ${IOS_APP_MIN_RUNTIME}+ simulator runtime`,
      simulators.length > 0,
      simulators.length > 0
        ? [...new Set(simulators.map((s) => s.runtimeName))].join(", ")
        : undefined,
    ) && ok;
  ok =
    check(
      "iPhone or iPad simulator",
      simulators.length > 0,
      simulators.length > 0 ? `${simulators.length} available` : undefined,
    ) && ok;
  ok = check("bun", Bun.which("bun") !== null) && ok;
  const ns = existsSync(join(SHELL_DIR, "node_modules", ".bin", "ns")) || Bun.which("ns") !== null;
  ok = check("NativeScript CLI (ns)", ns, "bun run postinstall (installs hosts/ios/app)") && ok;
  ok = check("ios-app shell", existsSync(join(SHELL_DIR, "package.json")), SHELL_DIR) && ok;
  ok =
    check(
      "ios-app node_modules",
      existsSync(join(SHELL_DIR, "node_modules", "nativescript")),
      "bun install at the repo root",
    ) && ok;
  ok =
    check(
      `NativeScript Xcode project (${IOS_NS_PROJECT_NAME}.xcodeproj)`,
      existsSync(iosNativePlatformPbxproj()),
      existsSync(iosNativePlatformPbxproj())
        ? undefined
        : "first `run` runs `ns prepare ios` automatically",
    ) && ok;
  const rubyEnv = iosAppRubyEnv();
  const xcodeproj = run("ruby", ["-e", "require 'xcodeproj'"], {
    cwd: SHELL_DIR,
    inherit: false,
    env: { ...process.env, ...rubyEnv },
  });
  ok =
    check(
      "Ruby gem xcodeproj (NativeScript xcconfig merge)",
      xcodeproj.exitCode === 0,
      xcodeproj.exitCode === 0
        ? undefined
        : "run `bundle install` in hosts/ios/app (Simulator fast path may still work)",
    ) && ok;
  console.log("\nGuest staging / .app sync:");
  const staging = diagnoseIosAppStaging();
  for (const line of staging.lines) {
    console.log(`  ${line}`);
  }
  ok = staging.ok && ok;
  if (!ok) process.exit(1);
  console.log("\nready: bun tools/ios-app.ts run");
}

async function listDevices(): Promise<void> {
  const simulators = await admissibleIosAppSimulators();
  if (simulators.length === 0) {
    console.log("no admissible simulators — install an iOS 16+ runtime in Xcode");
    return;
  }
  for (const simulator of simulators) {
    console.log(
      `  ${simulator.udid}  ${simulator.state.padEnd(8)}  ${simulator.name} (${simulator.runtimeName})`,
    );
  }
}

async function buildGuest(density: number, tickHz: number): Promise<GuestArtifacts> {
  const manifest = JSON.parse(readFileSync(manifestPath(), "utf8"));
  const plan = resolveIosAppBuildPlan(manifest, density);
  mkdirSync(join(PROJECT_ROOT, ".pocket/ios-app"), { recursive: true });
  writeFileSync(PLAN_PATH, JSON.stringify(plan, null, 2) + "\n");

  rmSync(GUEST_DIR, { recursive: true, force: true });
  mkdirSync(GUEST_DIR, { recursive: true });
  mustRun(process.execPath, [
    join(PROJECT_ROOT, "tools/build.ts"),
    `--plan=${PLAN_PATH}`,
    `--project-root=${PROJECT_ROOT}`,
    `--outdir=${GUEST_DIR}`,
    `--hz=${tickHz}`,
    "--extra-chars=0123456789",
  ]);

  const inputs = extractHostBuildInputs(plan, { expectedTarget: IOS_APP_TARGET_ID });
  const bundle = join(GUEST_DIR, `${inputs.appOutput}.js`);
  const pak = join(GUEST_DIR, `${inputs.appOutput}.pak`);
  if (!existsSync(bundle) || !existsSync(pak)) {
    throw new Error("ios-app: guest build did not produce .js and .pak");
  }
  const stamp: BuildStamp = { tickHz, density };
  writeFileSync(STAMP_PATH, JSON.stringify(stamp, null, 2) + "\n");
  return { appOutput: inputs.appOutput, bundle, pak, planPath: PLAN_PATH };
}

function stageAssets(artifacts: GuestArtifacts, tickHz: number): void {
  stageGuestIntoShell({
    shellDir: SHELL_DIR,
    appOutput: artifacts.appOutput,
    bundlePath: artifacts.bundle,
    pakPath: artifacts.pak,
    planPath: artifacts.planPath,
    tickHz,
    externalGuest: false,
  });
}

async function installShellDependencies(): Promise<void> {
  ensureIosAppShell();
  nativeScriptEnv();
}

function normalizeSimulatorArgs(args: readonly string[]): string[] {
  const rest = [...args];
  const first = rest[0];
  if (first && !first.startsWith("-") && /^[0-9A-Fa-f-]{8,}/.test(first)) {
    rest[0] = `--device=${first}`;
  }
  return rest;
}

async function runApp(args: readonly string[]): Promise<void> {
  const normalized = normalizeSimulatorArgs(args);
  const density = densityFlag(normalized);
  const requestedHz = tickRateFlag(normalized);
  const tickHz = requestedHz ?? DEFAULT_TICK_HZ;

  let artifacts: GuestArtifacts;
  if (normalized.includes("--no-build")) {
    if (!existsSync(PLAN_PATH)) {
      throw new Error("ios-app: --no-build but no plan — run build first");
    }
    const plan = JSON.parse(readFileSync(PLAN_PATH, "utf8"));
    const inputs = extractHostBuildInputs(plan, { expectedTarget: IOS_APP_TARGET_ID });
    artifacts = {
      appOutput: inputs.appOutput,
      bundle: join(GUEST_DIR, `${inputs.appOutput}.js`),
      pak: join(GUEST_DIR, `${inputs.appOutput}.pak`),
      planPath: PLAN_PATH,
    };
    if (!existsSync(artifacts.bundle) || !existsSync(artifacts.pak)) {
      throw new Error("ios-app: --no-build but guest artifacts missing");
    }
    if (existsSync(STAMP_PATH)) {
      const stamp = JSON.parse(readFileSync(STAMP_PATH, "utf8")) as BuildStamp;
      if (requestedHz !== undefined && requestedHz !== stamp.tickHz) {
        throw new Error(`ios-app: prior build used ${stamp.tickHz} Hz — rebuild or drop --hz`);
      }
      if (flagValue(normalized, "--density") !== undefined && density !== stamp.density) {
        throw new Error(`ios-app: prior build used density ${stamp.density} — rebuild`);
      }
    }
  } else {
    artifacts = await buildGuest(density, tickHz);
  }

  stageAssets(artifacts, tickHz);
  await installShellDependencies();
  await ensureIosNativeScriptPlatform();
  ensureSwiftUiBootInPlatformXcconfigs();
  ensurePocketHomeNativeSourcesInXcodeProject();

  await runIosWebpackOnce(nativeScriptEnv());
  mergeIosPluginsXcconfig(nativeScriptEnv());

  if (normalized.includes("--no-launch")) {
    console.log(`ios-app: staged into ${SHELL_DIR}`);
    return;
  }

  const physicalUdid = flagValue(normalized, "--udid");
  const physical = normalized.includes("--physical") || physicalUdid !== undefined;

  const runArgs = ["run", "ios", "--no-hmr"];
  if (physical) {
    if (!physicalUdid) {
      throw new Error("ios-app: --physical requires --udid=<device> (USB device from Xcode)");
    }
    console.log(`ios-app: launching on USB device ${physicalUdid}`);
    runArgs.push("--device", physicalUdid);
  } else {
    const simulator = await pickIosAppSimulator(
      flagValue(normalized, "--simulator") ?? flagValue(normalized, "--device"),
    );
    console.log(
      `ios-app: launching on ${simulator.name} (${simulator.runtimeName}, ${simulator.udid})`,
    );
    await ensureSimulatorReady(simulator);
    const release = normalized.includes("--release");
    const appPath = await buildIosSimulatorApp(simulator.udid, release);
    await installAndLaunchSimulatorApp(simulator.udid, appPath, normalized.includes("--attach"));
    return;
  }

  if (!normalized.includes("--attach")) runArgs.push("--justlaunch");
  if (normalized.includes("--release")) runArgs.push("--release");
  console.log("ios-app: NativeScript USB run…");
  const ran = await spawnNativeScript(runArgs, { [POCKET_IOS_WEBPACK_DONE]: "1" });
  if (ran.exitCode !== 0) throw new Error("ios-app: ns run ios failed");
}

function printHelp(): void {
  console.log(`Usage: bun tools/ios-app.ts <command> [flags]

Commands:
  doctor              Xcode, iOS SDK, NativeScript CLI
  devices             List arm64 iPhone/iPad simulators (iOS 16+)
  build               Guest bundle for ios-dev (viewport from pocket.json)
  run                 build (unless --no-build), stage shell, launch

Flags (build/run):
  --density=1..${IOS_APP_MAX_DENSITY}   raster density (default ${IOS_APP_DEFAULT_DENSITY})
  --hz=60|120         guest tick rate (default ${DEFAULT_TICK_HZ})
  --simulator=<name|udid>  Simulator (default: booted, else newest iPad)
  --device=<name|udid>     alias for --simulator
  --physical --udid=<udid>  USB iPhone/iPad (same NativeScript app as Simulator)
  --no-build          reuse dist/ios-app/guest
  --no-launch         stage only
  --attach            keep ns attached for logs
  --release           release shell build
`);
}

const [command, ...rest] = Bun.argv.slice(2);

switch (command) {
  case "doctor":
    await doctor();
    break;
  case "devices":
    await listDevices();
    break;
  case "build": {
    const density = densityFlag(rest);
    const tickHz = tickRateFlag(rest) ?? DEFAULT_TICK_HZ;
    const artifacts = await buildGuest(density, tickHz);
    console.log(`ios-app: built ${artifacts.bundle}`);
    break;
  }
  case "run":
  case "play":
    await runApp(rest);
    break;
  case "help":
  case undefined:
    printHelp();
    break;
  default:
    printHelp();
    process.exit(1);
}
