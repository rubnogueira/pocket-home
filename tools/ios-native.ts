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
import { ensureStubSdk } from "./ios-native/stub-sdk.ts";
import {
  type IosNativeTier,
  IOS_NATIVE_TIERS,
  listIosNativeTierIds,
  resolveIosNativeTier,
} from "./ios-native/tiers.ts";

const fw = frameworkRoot();
const HOST_ROOT = IOS_TAKEOVER_HOST;
const DEVICE_SSH_PORT = 22;
/** Pocket Home's iOS engine crate (pocket-apple ABI + live viewport); builds on engineRoot()'s crates. */
const TAKEOVER_ENGINE = join(PROJECT_ROOT, "engine/ios-takeover");
const BUNDLE_NAME = "PocketHome.app";
const BUNDLE_ID = "dev.pocket-home.dashboard";
/**
 * Where the app installs: /Applications on rootful jailbreaks (iOS 3-14), /var/jb/Applications on
 * rootless ones (Dopamine, palera1n rootless: iOS 15+), whose system volume stays read-only.
 */
function installPath(port: number): string {
  const rootless = remote(port, "test -d /var/jb/Applications").exitCode === 0;
  return `${rootless ? "/var/jb/Applications" : "/Applications"}/${BUNDLE_NAME}`;
}
const APP_ICON_SOURCE = join(
  PROJECT_ROOT,
  "hosts/ios/app/App_Resources/iOS/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png",
);
/** [file, px]: iPhone 57/114 (iOS 6), 120/180 (7+); iPad 72/144 (6), 76/152 (7+). */
const APP_ICONS: readonly (readonly [string, number])[] = [
  ["Icon.png", 57],
  ["Icon@2x.png", 114],
  ["Icon-72.png", 72],
  ["Icon-72@2x.png", 144],
  ["Icon-76.png", 76],
  ["Icon-76@2x.png", 152],
  ["Icon-60@2x.png", 120],
  ["Icon-60@3x.png", 180],
];
const STATUS_PATH = "/private/var/tmp/pocketjs-ios-native.status.json";
/** GPU renderer sources in hosts/ios/takeover (shared with tools/ios-app/pocket-apple-framework.ts). */
const RENDERER_SOURCES = [
  "PocketRenderer.h",
  "PocketRenderer.m",
  "PocketRenderBackend.h",
  "PocketGLBackend.m",
  "PocketMetalBackend.m",
  "PocketRenderer.metal",
];

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

function planPath(tier: IosNativeTier, density: number): string {
  return join(PROJECT_ROOT, ".pocket/ios-native", tier.id, `pocket-home.d${density}.plan.json`);
}

/** Bundle name of the guest baked at `density` (runtime.m loads `<name>.js` + `<name>.pak`). */
function guestName(appOutput: string, density: number): string {
  return `${appOutput}@${density}x`;
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

/**
 * SSH options for jailbroken devices. Their OpenSSH (iOS 3–9 era Cydia builds) offers only
 * ssh-rsa (or DSA, which current ssh cannot use at all) host keys and checks RSA user keys with
 * SHA-1; current macOS ssh disables both by default, so they are enabled for these connections
 * only (no ~/.ssh/config changes). The tunnel's local port changes every run, so the device's
 * host key is not recorded in known_hosts.
 */
const DEVICE_SSH_OPTIONS = [
  "-o",
  "BatchMode=yes",
  "-o",
  "ConnectTimeout=5",
  "-o",
  "StrictHostKeyChecking=no",
  "-o",
  "UserKnownHostsFile=/dev/null",
  "-o",
  "LogLevel=ERROR",
  "-o",
  "HostKeyAlgorithms=+ssh-rsa",
  "-o",
  "PubkeyAcceptedAlgorithms=+ssh-rsa",
];

function remote(port: number, command: string): CommandResult {
  return run("ssh", ["-p", String(port), ...DEVICE_SSH_OPTIONS, "root@127.0.0.1", command]);
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

function tierArch(tier: IosNativeTier): string {
  return tier.clangTarget.split("-")[0];
}

/** Whether the SDK's libSystem stub lists `arch` (else linking fails). */
function sdkLinksArch(sdk: string, arch: string): boolean {
  for (const stub of ["usr/lib/libSystem.tbd", "usr/lib/libSystem.B.tbd"]) {
    const path = join(sdk, stub);
    if (!existsSync(path)) continue;
    const text = readFileSync(path, "utf8").slice(0, 4096);
    // tbd v4: "targets: [ armv7-ios, ... ]"; tbd v2/v3: "archs: [ armv7, arm64 ]".
    if (new RegExp(`[\\[ ,]${arch}(-ios)?[\\] ,]`).test(text)) return true;
  }
  return false;
}

/**
 * iPhoneOS SDK for the tier: POCKET_IOS_SDK when set, else Xcode's when it links the tier's
 * architecture, else a link SDK generated from Xcode's (tools/ios-native/stub-sdk.ts — current
 * Xcode ships arm64 stubs only, so every 32-bit tier takes this path; Xcode is not modified).
 */
function iosSdkPath(tier: IosNativeTier): string {
  if (process.env.POCKET_IOS_SDK) return process.env.POCKET_IOS_SDK;
  const xcode = mustRun("xcrun", ["--sdk", "iphoneos", "--show-sdk-path"]);
  return sdkLinksArch(xcode, tierArch(tier)) ? xcode : ensureStubSdk(xcode, tierArch(tier));
}

async function doctor(tier: IosNativeTier): Promise<void> {
  let ok = true;
  for (const name of ["bun", "cargo", "rustup", "xcrun", "idevice_id", "iproxy", "ssh", "scp"]) {
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
  } else if (commandPath("rustup")) {
    // Stable tiers link the prebuilt std for their triple (a rustup target, per toolchain).
    const installed = run("rustup", ["target", "list", "--installed"], { cwd: TAKEOVER_ENGINE })
      .stdout.split("\n")
      .map((line) => line.trim());
    ok =
      check(
        `Rust std for ${tier.rustTargetTriple}`,
        installed.includes(tier.rustTargetTriple),
        installed.includes(tier.rustTargetTriple)
          ? "installed"
          : `rustup target add ${tier.rustTargetTriple}`,
      ) && ok;
  }
  const sdk = commandPath("xcrun") ? iosSdkPath(tier) : "";
  ok =
    check(
      `iPhoneOS SDK links ${tierArch(tier)}`,
      sdk !== "" && sdkLinksArch(sdk, tierArch(tier)),
      sdk || "xcrun not found",
    ) && ok;
  if (!ok) process.exit(1);
}

async function buildAll(): Promise<void> {
  for (const id of listIosNativeTierIds()) {
    await build(resolveIosNativeTier(id));
  }
}

async function build(tier: IosNativeTier): Promise<void> {
  const sdk = iosSdkPath(tier);
  const manifest = JSON.parse(readFileSync(manifestPath(), "utf8"));
  // A legacy stack deploying through this tier (tools/ios-device.ts ship) passes its phone
  // canvas: pocket.json's tablet canvas would be squeezed onto a 320x480 screen.
  const legacyLogical = process.env.POCKET_IOS_LEGACY_LOGICAL?.split(",").map(Number);
  if (legacyLogical?.length === 2 && legacyLogical.every((n) => Number.isInteger(n) && n > 0)) {
    manifest.app.viewport.fixed.logical = legacyLogical;
  }
  // One guest per density the tier's devices have (glyphs and icons are baked per density): the
  // app loads the one matching the screen, so 1x iPads and 2x/3x phones all draw text 1:1.
  rmSync(guestDirectory(tier), { recursive: true, force: true });
  const guests = tier.rasterDensities.map((guestDensity) => {
    const plan = resolveIosNativeBuildPlan(manifest, tier.id, guestDensity);
    const planFile = planPath(tier, guestDensity);
    mkdirSync(dirname(planFile), { recursive: true });
    writeFileSync(planFile, JSON.stringify(plan, null, 2) + "\n");
    const guestInputs = extractHostBuildInputs(plan, { expectedTarget: tier.targetId });
    const guestDir = join(guestDirectory(tier), `d${guestDensity}`);
    mkdirSync(guestDir, { recursive: true });
    mustRun(process.execPath, [
      join(PROJECT_ROOT, "tools/build.ts"),
      `--plan=${planFile}`,
      `--project-root=${PROJECT_ROOT}`,
      `--outdir=${guestDir}`,
    ]);
    const javaScript = join(guestDir, `${guestInputs.appOutput}.js`);
    const pak = join(guestDir, `${guestInputs.appOutput}.pak`);
    if (!existsSync(javaScript) || !existsSync(pak)) {
      throw new Error("ios-native: guest build did not produce .js and .pak artifacts");
    }
    return { density: guestDensity, plan: planFile, inputs: guestInputs, javaScript, pak };
  });
  const inputs = (guests.find((g) => g.density === tier.defaultRasterDensity) ?? guests[0]!).inputs;
  const [logicalW, logicalH] = inputs.viewport.logical;
  const density = inputs.viewport.rasterDensity;

  const rustTargetDir = join(homedir(), ".cache/pocket-stack/ios-native", tier.id, "rust-target");
  mkdirSync(rustTargetDir, { recursive: true });
  const cargo = tier.requiresRustNightly
    ? mustRun("rustup", ["which", "--toolchain", "nightly", "cargo"])
    : mustRun("rustup", ["which", "cargo"]);
  const rustc = tier.requiresRustNightly
    ? mustRun("rustup", ["which", "--toolchain", "nightly", "rustc"])
    : mustRun("rustup", ["which", "rustc"]);
  const armv = tierArch(tier).startsWith("armv");
  const rustEnv = {
    ...process.env,
    RUSTC: rustc,
    CARGO_TARGET_DIR: rustTargetDir,
    IPHONEOS_DEPLOYMENT_TARGET: tier.deploymentTarget,
    // C built by crates (QuickJS via rquickjs-sys) as ARM, not Thumb: see NO_THUMB below.
    // TARGET_CFLAGS reaches only the iOS target, not build scripts compiled for the Mac.
    ...(armv
      ? { TARGET_CFLAGS: [process.env.TARGET_CFLAGS, "-marm"].filter(Boolean).join(" ") }
      : {}),
  };
  const cargoArgs = [
    "build",
    "--release",
    "--locked",
    "--target",
    tier.rustTargetSpec ?? tier.rustTargetTriple,
  ];
  // pocket-apple needs std (anyhow, taffy -> slotmap, rquickjs), so build all of it for targets
  // rustc ships no prebuilt std for (the 32-bit ARM specs).
  if (tier.requiresRustNightly) cargoArgs.push("-Z", "build-std=std,panic_abort");
  // Current nightlies only accept a custom `.json` target spec behind this flag.
  if (tier.requiresRustNightly && tier.rustTargetSpec?.endsWith(".json")) {
    cargoArgs.push("-Z", "json-target-spec");
  }
  mustRun(cargo, cargoArgs, { cwd: TAKEOVER_ENGINE, env: rustEnv });

  // Cargo names the output directory after a custom target spec's file stem, not the triple.
  const rustTargetDirName = tier.rustTargetSpec
    ? tier.rustTargetSpec
        .split("/")
        .pop()!
        .replace(/\.json$/, "")
    : tier.rustTargetTriple;
  const rustLibrary = join(rustTargetDir, `${rustTargetDirName}/release/libpocket_home_ios.a`);
  if (!existsSync(rustLibrary)) {
    throw new Error(`ios-native: missing Rust static library at ${rustLibrary}`);
  }

  const bundle = bundleDirectory(tier);
  rmSync(bundle, { recursive: true, force: true });
  mkdirSync(bundle, { recursive: true });
  cpSync(join(HOST_ROOT, "Info.plist"), join(bundle, "Info.plist"));
  // SpringBoard refuses (and hides) apps whose MinimumOSVersion is above the running iOS.
  mustRun("plutil", [
    "-replace",
    "MinimumOSVersion",
    "-string",
    tier.deploymentTarget,
    join(bundle, "Info.plist"),
  ]);
  cpSync(join(HOST_ROOT, "PkgInfo"), join(bundle, "PkgInfo"));
  // Home-screen icons (names listed in Info.plist), scaled from the modern app's icon.
  for (const [name, size] of APP_ICONS) {
    mustRun("sips", [
      "-z",
      String(size),
      String(size),
      APP_ICON_SOURCE,
      "--out",
      join(bundle, name),
    ]);
  }
  for (const guest of guests) {
    const name = guestName(inputs.appOutput, guest.density);
    cpSync(guest.javaScript, join(bundle, `${name}.js`));
    cpSync(guest.pak, join(bundle, `${name}.pak`));
  }

  // Below iOS 10 the engine needs clock_gettime / CCRandomGenerateBytes from us (legacy-shims.c).
  const deploymentMajor = Number(tier.deploymentTarget.split(".")[0]);
  const legacyShims = deploymentMajor < 10 ? [join(HOST_ROOT, "legacy-shims.c")] : [];
  // Below iOS 6 (no LC_MAIN) the entry point comes from crt1.3.1.o, which Xcode no longer ships:
  // legacy-start.S provides it, linked with -nostartfiles.
  const legacyStart = deploymentMajor < 6 ? [join(HOST_ROOT, "legacy-start.S")] : [];
  // The host view (PocketSurfaceView) and engine header are Pocket Home's copies (live viewport,
  // vsync frames, timings, the GPU renderer in PocketRenderer + its Metal / OpenGL ES backends); the engine is
  // engine/ios-takeover.
  const iosUIKit = HOST_ROOT;
  const iosInclude = join(TAKEOVER_ENGINE, "include");
  const buildId = hashInputs([
    ...guests.flatMap((guest) => [guest.plan, guest.javaScript, guest.pak]),
    join(HOST_ROOT, "Info.plist"),
    join(HOST_ROOT, "PkgInfo"),
    join(HOST_ROOT, "runtime.m"),
    join(iosInclude, "pocket_apple.h"),
    join(iosUIKit, "PocketSurfaceView.h"),
    join(iosUIKit, "PocketSurfaceView.m"),
    ...RENDERER_SOURCES.map((name) => join(iosUIKit, name)),
    join(TAKEOVER_ENGINE, "src/lib.rs"),
    ...legacyShims,
    ...legacyStart,
    { label: "native/libpocket_home_ios.a", path: rustLibrary },
  ]);

  const executable = join(bundle, "PocketHome");
  const clang = ["--sdk", "iphoneos", "clang", "-target", tier.clangTarget, "-isysroot", sdk];
  const compileArgs = [
    ...clang,
    // Keep `[X alloc]` a message send: clang otherwise calls objc_alloc (iOS 12.2+ runtime).
    "-fno-objc-convert-messages-to-runtime-calls",
    // 32-bit ARM: no Thumb code at all (NO_THUMB below).
    ...(tierArch(tier).startsWith("armv") ? ["-marm"] : []),
    "-fobjc-arc",
    "-fblocks",
    "-O2",
    `-DPOCKETJS_BUILD_ID="${buildId}"`,
    `-DPOCKETJS_APP_OUTPUT="${inputs.appOutput}"`,
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
  ];
  // Compile, then link without -fobjc-arc: for deployment targets below iOS 9 the driver would
  // otherwise link libarclite, which current Xcode no longer ships (iOS 5+ runtimes have ARC).
  const objectDir = join(dirname(bundle), "obj");
  rmSync(objectDir, { recursive: true, force: true });
  mkdirSync(objectDir, { recursive: true });
  const objects = [
    join(HOST_ROOT, "runtime.m"),
    join(iosUIKit, "PocketSurfaceView.m"),
    ...RENDERER_SOURCES.filter((name) => name.endsWith(".m")).map((name) => join(iosUIKit, name)),
    ...legacyShims,
    ...legacyStart,
  ].map((source) => {
    const object = join(
      objectDir,
      `${source
        .split("/")
        .pop()!
        .replace(/\.[mcS]$/, "")}.o`,
    );
    mustRun("xcrun", [...compileArgs, "-c", source, "-o", object]);
    return object;
  });
  mustRun("xcrun", [
    ...clang,
    ...objects,
    rustLibrary,
    // Resolve every import in whichever system library exports it on the device: symbols moved
    // between libraries across iOS releases (NSRunLoop, NSTimer, NSDate... live in
    // CoreFoundation in the SDK, in Foundation on older iOS), and two-level bindings to the
    // SDK's library would abort the launch there.
    "-Wl,-flat_namespace",
    ...(legacyStart.length > 0 ? ["-nostartfiles"] : []),
    "-framework",
    "Foundation",
    "-framework",
    "UIKit",
    "-framework",
    "QuartzCore",
    "-framework",
    "CoreGraphics",
    "-framework",
    "OpenGLES",
    // Metal backend: arm64 only (no Metal on the 32-bit devices, whose builds compile it out).
    ...(armv ? [] : ["-framework", "Metal"]),
    "-lresolv",
    "-Wl,-dead_strip",
    "-o",
    executable,
  ]);
  // NO_THUMB: the current linker writes Thumb code addresses without the Thumb bit — LC_MAIN's
  // entry (a Thumb `main` died on its second instruction) and function pointers stored in data
  // (QuickJS's allocator table: SIGILL in js_def_calloc). Every address is then entered in ARM
  // state, so every function must be ARM: the host and crate C are built with -marm, Rust
  // emits ARM for these specs. Fail here rather than on the device.
  if (tierArch(tier).startsWith("armv")) {
    const thumb = mustRun("xcrun", ["nm", "-m", executable])
      .split("\n")
      .filter((line) => line.includes("[Thumb]"));
    if (thumb.length > 0) {
      throw new Error(
        `ios-native: ${thumb.length} Thumb function(s) in the ${tier.id} executable (the linker ` +
          `drops their Thumb bit, so they crash when called), e.g.\n${thumb.slice(0, 5).join("\n")}`,
      );
    }
  }
  // arm64: the Metal backend's shaders, precompiled (PocketMetalBackend.m loads them).
  if (!armv) {
    const air = join(objectDir, "PocketRenderer.air");
    mustRun("xcrun", [
      "-sdk",
      "iphoneos",
      "metal",
      `-mios-version-min=${tier.deploymentTarget}`,
      "-c",
      join(HOST_ROOT, "PocketRenderer.metal"),
      "-o",
      air,
    ]);
    mustRun("xcrun", [
      "-sdk",
      "iphoneos",
      "metallib",
      air,
      "-o",
      join(bundle, "PocketRenderer.metallib"),
    ]);
  }
  mustRun("chmod", ["755", executable]);
  // Jailbreaks accept a pseudo/ad-hoc signature: ldid when installed, else macOS codesign
  // (which emits SHA-1 + SHA-256 code directories for pre-iOS 11 deployment targets).
  if (commandPath("ldid")) mustRun("ldid", ["-S", executable]);
  else mustRun("codesign", ["--force", "--sign", "-", "--timestamp=none", executable]);
  mustRun("plutil", ["-lint", join(bundle, "Info.plist")]);

  const fileNames = [
    "PocketHome",
    "Info.plist",
    "PkgInfo",
    "PocketRenderer.metallib",
    ...APP_ICONS.map(([name]) => name),
    ...guests.flatMap((guest) => {
      const name = guestName(inputs.appOutput, guest.density);
      return [`${name}.js`, `${name}.pak`];
    }),
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
  console.log(
    `build_id=${buildId} tier=${tier.id} logical=${logicalW}x${logicalH} ` +
      `densities=${tier.rasterDensities.join(",")}`,
  );
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
    const target = installPath(port);
    remote(port, `rm -rf ${target} /Applications/${BUNDLE_NAME} 2>/dev/null`);
    mustRun("scp", [
      // Legacy SCP protocol: current scp defaults to SFTP, which old device builds may lack.
      "-O",
      "-r",
      "-P",
      String(port),
      ...DEVICE_SSH_OPTIONS,
      bundle,
      `root@127.0.0.1:${target}`,
    ]);
    if (target.startsWith("/var/jb/")) {
      // uikittools-ng (rootless): register just this bundle.
      mustRemote(port, `uicache -p ${target}`);
    } else {
      // SpringBoard's app registry belongs to `mobile`; root's uicache did not refresh it on iOS 9.
      mustRemote(port, "su mobile -c uicache 2>/dev/null || uicache");
    }
    console.log("ios-native: deployed");
  });
}

async function launch(_tier: IosNativeTier): Promise<void> {
  await withTunnel(async (port) => {
    remote(port, "killall PocketHome 2>/dev/null || true");
    await Bun.sleep(500);
    // As `mobile` (SpringBoard's user). SpringBoard ignores URL launches while the screen is
    // locked, so the device must be unlocked.
    mustRemote(
      port,
      `cd /tmp; su mobile -c "uiopen ${BUNDLE_ID}://" 2>/dev/null || uiopen ${BUNDLE_ID}://`,
    );
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
