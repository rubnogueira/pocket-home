// Jailbroken iPhone / iPad — tiered by CPU + iOS generation (not device model).
//
//   bun tools/ios-native.ts list
//   bun tools/ios-native.ts [--tier=armv7-ios9] doctor|build|deploy|launch
//   bun tools/ios-native.ts deploy [--build]   # build if missing; --build forces rebuild
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { extractHostBuildInputs } from "@pocketjs/framework/manifest";
import { frameworkRoot, PROJECT_ROOT } from "./paths.ts";
import { IOS_TAKEOVER_HOST } from "./ios/paths.ts";
import { resolveIosNativeBuildPlan } from "./ios-native/profile.ts";
import {
  type IosNativeTier,
  IOS_NATIVE_TIERS,
  listIosNativeTierIds,
  resolveIosNativeTier,
} from "./ios-native/tiers.ts";

const fw = frameworkRoot();
const HOST_ROOT = IOS_TAKEOVER_HOST;
const DEVICE_SSH_PORT = 22;
const BUNDLE_NAME = "PocketHome.app";
const BUNDLE_ID = "dev.pocket-home.dashboard";
const INSTALL_PATH = `/Applications/${BUNDLE_NAME}`;
const STATUS_PATH = "/private/var/tmp/pocketjs-ios-native.status.json";

interface CommandResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

interface BuildReceipt {
  readonly schema: 1;
  readonly buildId: string;
  readonly bundleId: string;
  readonly target: string;
  readonly tier: string;
  readonly hostAbi: number;
  readonly deploymentTarget: string;
  readonly files: Readonly<Record<string, string>>;
}

function parseCli(argv: string[]): {
  tier: IosNativeTier | undefined;
  command: string;
  forceBuild: boolean;
  auto: boolean;
  udid?: string;
} {
  let tierId: string | undefined = process.env.POCKET_IOS_TIER;
  let forceBuild = false;
  let auto = false;
  let udid: string | undefined = process.env.POCKET_IOS_UDID;
  const rest: string[] = [];
  for (const arg of argv) {
    if (arg.startsWith("--tier=")) tierId = arg.slice("--tier=".length);
    else if (arg.startsWith("--udid=")) udid = arg.slice("--udid=".length);
    else if (arg === "--build") forceBuild = true;
    else if (arg === "--auto") auto = true;
    else rest.push(arg);
  }
  const command = rest[0] ?? "help";
  const autoCommands = new Set(["detect", "deploy", "launch", "build", "ship"]);
  if (!tierId && (auto || autoCommands.has(command))) {
    auto = true;
  }
  const tier = tierId ? resolveIosNativeTier(tierId) : undefined;
  return { tier, command, forceBuild, auto, udid };
}

function run(
  executable: string,
  args: readonly string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
): CommandResult {
  const result = Bun.spawnSync({
    cmd: [executable, ...args],
    cwd: options.cwd ?? PROJECT_ROOT,
    env: options.env ?? process.env,
    stdout: "pipe",
    stderr: "pipe",
  });
  return {
    exitCode: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  };
}

function mustRun(
  executable: string,
  args: readonly string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
): string {
  const result = run(executable, args, options);
  if (result.exitCode !== 0) {
    const detail = [result.stdout.trim(), result.stderr.trim()].filter(Boolean).join("\n");
    throw new Error(
      `ios-native: ${executable} ${args.join(" ")} failed (${result.exitCode})${
        detail ? `:\n${detail}` : ""
      }`,
    );
  }
  return result.stdout.trim();
}

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

interface BuildIdentityInput {
  readonly label: string;
  readonly path: string;
}

function hashInputs(inputs: readonly (string | BuildIdentityInput)[]): string {
  const hash = createHash("sha256");
  for (const input of inputs) {
    const path = typeof input === "string" ? input : input.path;
    const label = typeof input === "string" ? path.slice(PROJECT_ROOT.length) : input.label;
    const bytes = readFileSync(path);
    hash.update(`${Buffer.byteLength(label)}:`);
    hash.update(label);
    hash.update(`${bytes.byteLength}:`);
    hash.update(bytes);
  }
  return hash.digest("hex").slice(0, 32);
}

function commandPath(name: string): string | undefined {
  return Bun.which(name) ?? undefined;
}

function check(label: string, ok: boolean, detail: string): boolean {
  console.log(`[${ok ? "ok" : "missing"}] ${label}: ${detail}`);
  return ok;
}

function manifestPath(): string {
  return join(PROJECT_ROOT, "pocket.json");
}

function planPath(tier: IosNativeTier): string {
  return join(PROJECT_ROOT, ".pocket/ios-native", tier.id, "pocket-home.plan.json");
}

function guestDirectory(tier: IosNativeTier): string {
  return join(PROJECT_ROOT, "dist/ios-native", tier.id, "guest");
}

function bundleDirectory(tier: IosNativeTier): string {
  return join(PROJECT_ROOT, "dist/ios-native", tier.id, BUNDLE_NAME);
}

function receiptPath(tier: IosNativeTier): string {
  return join(bundleDirectory(tier), "build-receipt.json");
}

function engineRoot(): string {
  const engine = join(fw, "engine");
  if (!existsSync(join(engine, "Cargo.toml"))) {
    throw new Error(
      "ios-native: engine/ not found — set POCKETJS_FRAMEWORK_ROOT to a full PocketJS checkout",
    );
  }
  return engine;
}

function remote(port: number, command: string): CommandResult {
  return run("ssh", [
    "-p",
    String(port),
    "-o",
    "BatchMode=yes",
    "-o",
    "ConnectTimeout=5",
    "-o",
    "StrictHostKeyChecking=no",
    "root@127.0.0.1",
    command,
  ]);
}

function mustRemote(port: number, command: string): string {
  const result = remote(port, command);
  if (result.exitCode !== 0) {
    throw new Error(
      `ios-native: device command failed (${result.exitCode}):\n${[
        result.stdout.trim(),
        result.stderr.trim(),
      ]
        .filter(Boolean)
        .join("\n")}`,
    );
  }
  return result.stdout.trim();
}

async function availableLocalPort(): Promise<number> {
  return await new Promise<number>((resolvePort, reject) => {
    const server = createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        server.close();
        reject(new Error("ios-native: could not allocate a loopback port"));
        return;
      }
      const port = address.port;
      server.close((error) => (error ? reject(error) : resolvePort(port)));
    });
  });
}

async function withTunnel<T>(operation: (port: number) => Promise<T> | T): Promise<T> {
  const port = await availableLocalPort();
  const tunnel = Bun.spawn({
    cmd: ["iproxy", `${port}:${DEVICE_SSH_PORT}`],
    cwd: PROJECT_ROOT,
    stdout: "ignore",
    stderr: "pipe",
  });
  try {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await Bun.sleep(300);
      if (remote(port, "true").exitCode === 0) return await operation(port);
      if (tunnel.exitCode !== null) break;
    }
    if (tunnel.exitCode === null) tunnel.kill();
    await tunnel.exited;
    const stderr = await new Response(tunnel.stderr as ReadableStream).text();
    throw new Error(
      `ios-native: USB SSH tunnel did not become ready${stderr ? `:\n${stderr}` : ""}`,
    );
  } finally {
    if (tunnel.exitCode === null) {
      tunnel.kill();
      await tunnel.exited;
    }
  }
}

function listTiers(): void {
  console.log("iOS native tiers (POCKET_IOS_TIER or --tier=):\n");
  for (const id of listIosNativeTierIds()) {
    const t = IOS_NATIVE_TIERS[id]!;
    console.log(`  ${id}`);
    console.log(`    ${t.description}`);
    console.log(`    target=${t.targetId}  min iOS=${t.deploymentTarget}  abi=${t.hostAbi}\n`);
  }
  console.log("Logical resolution comes from pocket.json (app.viewport.fixed.logical).");
  console.log("Modern iOS app (16+, Simulator/USB): bun run ios -- run");
  console.log("iOS 6.x armv7: PocketJS `iphone4s` host (separate incompatible toolchain).");
}

async function doctor(tier: IosNativeTier): Promise<void> {
  let ok = true;
  for (const name of [
    "bun",
    "cargo",
    "rustup",
    "xcrun",
    "ldid",
    "idevice_id",
    "iproxy",
    "ssh",
    "scp",
  ]) {
    const path = commandPath(name);
    ok = check(name, path !== undefined, path ?? "not found") && ok;
  }
  ok = check("PocketJS engine/", existsSync(join(engineRoot(), "Cargo.toml")), engineRoot()) && ok;
  ok =
    check(
      `tier ${tier.id}`,
      tier.rustTargetSpec ? existsSync(tier.rustTargetSpec) : true,
      tier.rustTargetSpec ?? tier.rustTargetTriple,
    ) && ok;
  if (tier.requiresRustNightly) {
    const nightlyRustup = commandPath("rustup")
      ? run("rustup", ["run", "nightly", "rustc", "--version"]).exitCode === 0
      : false;
    ok =
      check(
        "Rust nightly (build-std)",
        nightlyRustup,
        nightlyRustup
          ? "installed"
          : "rustup toolchain install nightly && rustup component add rust-src --toolchain nightly",
      ) && ok;
  }
  if (!ok) process.exit(1);
}

async function buildAll(): Promise<void> {
  for (const id of listIosNativeTierIds()) {
    await build(resolveIosNativeTier(id));
  }
}

async function build(tier: IosNativeTier): Promise<void> {
  const manifest = JSON.parse(readFileSync(manifestPath(), "utf8"));
  const plan = resolveIosNativeBuildPlan(manifest, tier.id);
  mkdirSync(dirname(planPath(tier)), { recursive: true });
  writeFileSync(planPath(tier), JSON.stringify(plan, null, 2) + "\n");
  const inputs = extractHostBuildInputs(plan, { expectedTarget: tier.targetId });

  const [logicalW, logicalH] = inputs.viewport.logical;
  const density = inputs.viewport.rasterDensity;

  const guestDir = guestDirectory(tier);
  rmSync(guestDir, { recursive: true, force: true });
  mkdirSync(guestDir, { recursive: true });
  mustRun(process.execPath, [
    join(PROJECT_ROOT, "tools/build.ts"),
    `--plan=${planPath(tier)}`,
    `--project-root=${PROJECT_ROOT}`,
    `--outdir=${guestDir}`,
  ]);

  const guestJavaScript = join(guestDir, `${inputs.appOutput}.js`);
  const guestPak = join(guestDir, `${inputs.appOutput}.pak`);
  if (!existsSync(guestJavaScript) || !existsSync(guestPak)) {
    throw new Error("ios-native: guest build did not produce .js and .pak artifacts");
  }

  const rustTargetDir = join(homedir(), ".cache/pocket-stack/ios-native", tier.id, "rust-target");
  mkdirSync(rustTargetDir, { recursive: true });
  const cargo = tier.requiresRustNightly
    ? mustRun("rustup", ["which", "--toolchain", "nightly", "cargo"])
    : mustRun("rustup", ["which", "cargo"]);
  const rustc = tier.requiresRustNightly
    ? mustRun("rustup", ["which", "--toolchain", "nightly", "rustc"])
    : mustRun("rustup", ["which", "rustc"]);
  const rustEnv = {
    ...process.env,
    RUSTC: rustc,
    CARGO_TARGET_DIR: rustTargetDir,
    IPHONEOS_DEPLOYMENT_TARGET: tier.deploymentTarget,
  };
  const cargoArgs = [
    "build",
    "-p",
    "pocket-apple",
    "--release",
    "--locked",
    "--target",
    tier.rustTargetSpec ?? tier.rustTargetTriple,
  ];
  if (tier.requiresRustNightly) cargoArgs.push("-Z", "build-std=core,alloc");
  mustRun(cargo, cargoArgs, { cwd: engineRoot(), env: rustEnv });

  const rustLibrary = join(rustTargetDir, `${tier.rustTargetTriple}/release/libpocket_apple.a`);
  if (!existsSync(rustLibrary)) {
    throw new Error(`ios-native: missing Rust static library at ${rustLibrary}`);
  }

  const bundle = bundleDirectory(tier);
  rmSync(bundle, { recursive: true, force: true });
  mkdirSync(bundle, { recursive: true });
  cpSync(join(HOST_ROOT, "Info.plist"), join(bundle, "Info.plist"));
  cpSync(join(HOST_ROOT, "PkgInfo"), join(bundle, "PkgInfo"));
  cpSync(guestJavaScript, join(bundle, `${inputs.appOutput}.js`));
  cpSync(guestPak, join(bundle, `${inputs.appOutput}.pak`));

  const iosUIKit = join(fw, "engine/ios/uikit");
  const iosInclude = join(fw, "engine/ios/include");
  const buildId = hashInputs([
    planPath(tier),
    guestJavaScript,
    guestPak,
    join(HOST_ROOT, "Info.plist"),
    join(HOST_ROOT, "PkgInfo"),
    join(HOST_ROOT, "runtime.m"),
    join(iosInclude, "pocket_apple.h"),
    join(iosUIKit, "PocketSurfaceView.h"),
    join(iosUIKit, "PocketSurfaceView.m"),
    join(fw, "engine/ios/src/lib.rs"),
    { label: "native/libpocket_apple.a", path: rustLibrary },
  ]);

  const executable = join(bundle, "PocketHome");
  const clangArgs = [
    "--sdk",
    "iphoneos",
    "clang",
    "-target",
    tier.clangTarget,
    "-fobjc-arc",
    "-fblocks",
    "-O2",
    `-DPOCKETJS_BUILD_ID=${buildId}`,
    `-DPOCKETJS_APP_OUTPUT=${inputs.appOutput}`,
    `-DPOCKETJS_LOGICAL_WIDTH=${logicalW}`,
    `-DPOCKETJS_LOGICAL_HEIGHT=${logicalH}`,
    `-DPOCKETJS_RASTER_DENSITY=${density}`,
    `-DPOCKETJS_HOST_ABI=${tier.hostAbi}`,
    `-DPOCKETJS_TIER_ID="${tier.id}"`,
    `-DPOCKETJS_HOST_ID="${tier.targetId}"`,
    "-I",
    iosUIKit,
    "-I",
    iosInclude,
    join(HOST_ROOT, "runtime.m"),
    join(iosUIKit, "PocketSurfaceView.m"),
    rustLibrary,
    "-framework",
    "Foundation",
    "-framework",
    "UIKit",
    "-framework",
    "QuartzCore",
    "-framework",
    "CoreGraphics",
    "-lresolv",
    "-Wl,-dead_strip",
    "-o",
    executable,
  ];
  mustRun("xcrun", clangArgs);
  mustRun("chmod", ["755", executable]);
  mustRun("ldid", ["-S", executable]);
  mustRun("plutil", ["-lint", join(bundle, "Info.plist")]);

  const fileNames = [
    "PocketHome",
    "Info.plist",
    "PkgInfo",
    `${inputs.appOutput}.js`,
    `${inputs.appOutput}.pak`,
  ];
  const files = Object.fromEntries(
    fileNames
      .filter((name) => existsSync(join(bundle, name)))
      .map((name) => [name, sha256(join(bundle, name))]),
  );
  const receipt: BuildReceipt = {
    schema: 1,
    buildId,
    bundleId: BUNDLE_ID,
    target: inputs.target,
    tier: tier.id,
    hostAbi: inputs.hostAbi,
    deploymentTarget: tier.deploymentTarget,
    files,
  };
  writeFileSync(receiptPath(tier), JSON.stringify(receipt, null, 2) + "\n");

  console.log(`built ${bundle}`);
  console.log(mustRun("file", [executable]));
  console.log(`build_id=${buildId} tier=${tier.id} logical=${logicalW}x${logicalH}@${density}`);
}

async function deploy(tier: IosNativeTier, options: { forceBuild?: boolean } = {}): Promise<void> {
  const hasReceipt = existsSync(receiptPath(tier));
  if (options.forceBuild || !hasReceipt) {
    if (options.forceBuild) {
      console.log(`ios-native: --build: rebuilding tier ${tier.id}`);
    } else {
      console.log(`ios-native: no build for tier ${tier.id}; building first`);
    }
    await build(tier);
  }
  const bundle = bundleDirectory(tier);
  await withTunnel(async (port) => {
    console.log(`ios-native: connected (tier ${tier.id})`);
    remote(port, "killall PocketHome 2>/dev/null || true");
    remote(port, `rm -rf ${INSTALL_PATH}`);
    mustRun("scp", [
      "-r",
      "-P",
      String(port),
      "-o",
      "BatchMode=yes",
      "-o",
      "StrictHostKeyChecking=no",
      bundle,
      `root@127.0.0.1:${INSTALL_PATH}`,
    ]);
    mustRemote(port, "uicache");
    console.log("ios-native: deployed");
  });
}

async function launch(_tier: IosNativeTier): Promise<void> {
  await withTunnel(async (port) => {
    remote(port, "killall PocketHome 2>/dev/null || true");
    await Bun.sleep(500);
    mustRemote(port, `uiopen ${BUNDLE_ID}://`);
    console.log("ios-native: launched");
    await Bun.sleep(2000);
    const statusResult = remote(port, `cat ${STATUS_PATH} 2>/dev/null`);
    if (statusResult.exitCode === 0 && statusResult.stdout.trim()) {
      try {
        const status = JSON.parse(statusResult.stdout.trim()) as {
          state?: string;
          guest_frames?: number;
          tier?: string;
        };
        console.log(`state=${status.state} tier=${status.tier} frames=${status.guest_frames}`);
      } catch {
        console.log(statusResult.stdout.trim());
      }
    }
  });
}

function printHelp(): void {
  console.log(`Usage: bun tools/ios-native.ts [--tier=<id>] [--auto] <command>

Commands: list | doctor | build | build-all | deploy | launch | detect | ship

Without --tier=, deploy/launch/build/ship auto-detect the USB device (see tools/ios-device.ts).

deploy: builds automatically when no receipt exists; pass --build to force rebuild first.

Default tier (when not auto): ${resolveIosNativeTier().id}
`);
}

async function runAuto(
  command: string,
  options: { forceBuild: boolean; udid?: string },
): Promise<void> {
  const script = join(PROJECT_ROOT, "tools/ios-device.ts");
  if (command === "detect") {
    mustRun(process.execPath, [
      script,
      "detect",
      ...(options.udid ? [`--udid=${options.udid}`] : []),
    ]);
    return;
  }
  if (command === "ship" || command === "deploy") {
    mustRun(process.execPath, [
      script,
      "ship",
      ...(options.forceBuild ? ["--build"] : []),
      ...(options.udid ? [`--udid=${options.udid}`] : []),
    ]);
    return;
  }
  if (command === "launch") {
    mustRun(process.execPath, [
      script,
      "ship",
      ...(options.udid ? [`--udid=${options.udid}`] : []),
    ]);
    return;
  }
  if (command === "build") {
    mustRun(process.execPath, [
      script,
      "ship",
      "--build",
      ...(options.udid ? [`--udid=${options.udid}`] : []),
    ]);
    return;
  }
  throw new Error(`ios-native: --auto does not apply to command ${command}`);
}

const { tier, command, forceBuild, auto, udid } = parseCli(process.argv.slice(2));

if (auto && !tier && command === "doctor") {
  mustRun(process.execPath, [
    join(PROJECT_ROOT, "tools/ios-device.ts"),
    "detect",
    ...(udid ? [`--udid=${udid}`] : []),
  ]);
  process.exit(0);
}

switch (command) {
  case "list":
    listTiers();
    break;
  case "detect":
    await runAuto("detect", { forceBuild, udid });
    break;
  case "ship":
    await runAuto("ship", { forceBuild, udid });
    break;
  case "doctor":
    if (!tier) {
      console.error("ios-native: doctor requires --tier= or run ios:doctor");
      process.exit(1);
    }
    await doctor(tier);
    break;
  case "build":
    if (!tier) {
      await runAuto("build", { forceBuild, udid });
      break;
    }
    await build(tier);
    break;
  case "build-all":
    await buildAll();
    break;
  case "deploy":
    if (!tier) {
      await runAuto("ship", { forceBuild, udid });
      break;
    }
    await deploy(tier, { forceBuild });
    break;
  case "launch":
    if (!tier) {
      await runAuto("launch", { forceBuild, udid });
      break;
    }
    await launch(tier);
    break;
  case "help":
  default:
    printHelp();
    if (command !== "help") process.exit(1);
}
