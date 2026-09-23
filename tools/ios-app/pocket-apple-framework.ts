// PocketApple.xcframework for the modern app, built from Pocket Home's engine and host view.
//
// @nativescript/pocketjs ships a prebuilt PocketApple.xcframework (pocket-apple + the upstream
// PocketSurfaceView): a fixed logical size per surface (rotation meant booting a new surface
// while the old one was shown stretched) and a CPU rasterizer. This builds the same framework
// (same name, module, class and C ABI, so the plugin's JS and the NativeScript metadata keep
// working) from:
//
//   * engine/ios-takeover — pocket-apple plus the live viewport (pocket_apple_set_viewport) and
//     the GPU DrawList exports;
//   * hosts/ios/takeover/PocketSurfaceView.m + PocketRenderer.m — the host view the jailbreak
//     tiers use: GPU rendering (Metal here), live resize presented inside the layout pass,
//     11-bit touch.
//
// One engine and one host view for every iOS release, from the iOS 5 takeover tier to the
// current App Store OS. The result replaces the plugin's copy in hosts/ios/app/node_modules (the
// Xcode project NativeScript generates references it there); `bun install` restores the prebuilt,
// and `tools/ios-app.ts run` installs this one again.
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { PROJECT_ROOT } from "../paths.ts";
import { IOS_APP_SHELL, IOS_TAKEOVER_HOST } from "../ios/paths.ts";

const ENGINE = join(PROJECT_ROOT, "engine/ios-takeover");
const OUT_DIR = join(PROJECT_ROOT, "dist/ios-app/PocketApple");
const XCFRAMEWORK = join(OUT_DIR, "PocketApple.xcframework");
const STAMP = join(OUT_DIR, "stamp.json");
const PLUGIN_XCFRAMEWORK = join(
  IOS_APP_SHELL,
  "node_modules/@nativescript/pocketjs/platforms/ios/PocketApple.xcframework",
);
/** Same floor as the modern app (hosts/ios/app/App_Resources/iOS/build.xcconfig). */
const DEPLOYMENT_TARGET = "16.0";

const SOURCES = [
  join(IOS_TAKEOVER_HOST, "PocketSurfaceView.m"),
  join(IOS_TAKEOVER_HOST, "PocketRenderer.m"),
  join(IOS_TAKEOVER_HOST, "PocketGLBackend.m"),
  join(IOS_TAKEOVER_HOST, "PocketMetalBackend.m"),
];
const SHADERS = join(IOS_TAKEOVER_HOST, "PocketRenderer.metal");
const PUBLIC_HEADERS = [
  join(IOS_TAKEOVER_HOST, "PocketSurfaceView.h"),
  join(ENGINE, "include/pocket_apple.h"),
];

interface Slice {
  readonly id: "ios-arm64" | "ios-arm64-simulator";
  readonly rustTarget: string;
  readonly clangTarget: string;
  readonly sdk: "iphoneos" | "iphonesimulator";
}

const SLICES: readonly Slice[] = [
  {
    id: "ios-arm64",
    rustTarget: "aarch64-apple-ios",
    clangTarget: `arm64-apple-ios${DEPLOYMENT_TARGET}`,
    sdk: "iphoneos",
  },
  {
    id: "ios-arm64-simulator",
    rustTarget: "aarch64-apple-ios-sim",
    clangTarget: `arm64-apple-ios${DEPLOYMENT_TARGET}-simulator`,
    sdk: "iphonesimulator",
  },
];

function mustRun(
  cmd: readonly string[],
  options: { cwd?: string; env?: Record<string, string | undefined> } = {},
): string {
  const result = Bun.spawnSync({
    cmd: [...cmd],
    cwd: options.cwd ?? PROJECT_ROOT,
    env: options.env ?? process.env,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode !== 0) {
    const detail = [result.stdout.toString().trim(), result.stderr.toString().trim()]
      .filter(Boolean)
      .join("\n");
    throw new Error(`pocket-apple: ${cmd.join(" ")} failed (${result.exitCode}):\n${detail}`);
  }
  return result.stdout.toString().trim();
}

/** Every file that decides the framework (engine sources, host view, this script). */
function inputFiles(): string[] {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else files.push(path);
    }
  };
  walk(join(ENGINE, "src"));
  walk(join(ENGINE, "include"));
  files.push(join(ENGINE, "Cargo.toml"), join(ENGINE, "Cargo.lock"));
  files.push(
    ...SOURCES,
    join(IOS_TAKEOVER_HOST, "PocketRenderer.h"),
    join(IOS_TAKEOVER_HOST, "PocketRenderBackend.h"),
    SHADERS,
    ...PUBLIC_HEADERS,
  );
  files.push(import.meta.path);
  // The engine builds on the installed framework's crates (patched by bun install).
  files.push(join(PROJECT_ROOT, "bun.lock"));
  return files.sort();
}

function inputsHash(): string {
  const hash = createHash("sha256");
  for (const file of inputFiles()) {
    hash.update(file.slice(PROJECT_ROOT.length));
    hash.update(readFileSync(file));
  }
  return hash.digest("hex").slice(0, 32);
}

function buildSlice(slice: Slice, workDir: string): string {
  const rustTargetDir = join(homedir(), ".cache/pocket-stack/ios-app/rust-target");
  const env = {
    ...process.env,
    CARGO_TARGET_DIR: rustTargetDir,
    IPHONEOS_DEPLOYMENT_TARGET: DEPLOYMENT_TARGET,
  };
  const cargo = mustRun(["rustup", "which", "cargo"], { cwd: ENGINE });
  mustRun([cargo, "build", "--release", "--locked", "--target", slice.rustTarget], {
    cwd: ENGINE,
    env,
  });
  const rustLibrary = join(rustTargetDir, slice.rustTarget, "release/libpocket_home_ios.a");

  const sdk = mustRun(["xcrun", "--sdk", slice.sdk, "--show-sdk-path"]);
  const clang = ["xcrun", "--sdk", slice.sdk, "clang", "-target", slice.clangTarget];
  const objDir = join(workDir, slice.id, "obj");
  mkdirSync(objDir, { recursive: true });
  const objects = SOURCES.map((source) => {
    const object = join(objDir, `${source.split("/").pop()!.replace(/\.m$/, "")}.o`);
    mustRun([
      ...clang,
      "-isysroot",
      sdk,
      "-fobjc-arc",
      "-fblocks",
      "-O2",
      "-I",
      IOS_TAKEOVER_HOST,
      "-I",
      join(ENGINE, "include"),
      "-c",
      source,
      "-o",
      object,
    ]);
    return object;
  });

  const framework = join(workDir, slice.id, "PocketApple.framework");
  mkdirSync(join(framework, "Headers"), { recursive: true });
  mkdirSync(join(framework, "Modules"), { recursive: true });
  mustRun([
    ...clang,
    "-isysroot",
    sdk,
    "-dynamiclib",
    "-install_name",
    "@rpath/PocketApple.framework/PocketApple",
    ...objects,
    // The whole engine: the plugin's JS reaches pocket_apple_* through the metadata, not
    // through references the linker could see.
    "-Wl,-force_load",
    rustLibrary,
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
    "-framework",
    "Metal",
    "-lresolv",
    "-Wl,-dead_strip",
    "-o",
    join(framework, "PocketApple"),
  ]);
  // The Metal backend's shaders, loaded from this framework's bundle.
  const air = join(objDir, "PocketRenderer.air");
  const versionFlag =
    slice.sdk === "iphonesimulator"
      ? `-mios-simulator-version-min=${DEPLOYMENT_TARGET}`
      : `-mios-version-min=${DEPLOYMENT_TARGET}`;
  mustRun(["xcrun", "-sdk", slice.sdk, "metal", versionFlag, "-c", SHADERS, "-o", air]);
  mustRun([
    "xcrun",
    "-sdk",
    slice.sdk,
    "metallib",
    air,
    "-o",
    join(framework, "PocketRenderer.metallib"),
  ]);
  for (const header of PUBLIC_HEADERS) {
    cpSync(header, join(framework, "Headers", header.split("/").pop()!));
  }
  writeFileSync(
    join(framework, "Headers/PocketApple.h"),
    "#import <PocketApple/PocketSurfaceView.h>\n#include <PocketApple/pocket_apple.h>\n",
  );
  writeFileSync(
    join(framework, "Modules/module.modulemap"),
    [
      "framework module PocketApple {",
      '  umbrella header "PocketApple.h"',
      "  export *",
      "  module * { export * }",
      "}",
      "",
    ].join("\n"),
  );
  const plist = join(framework, "Info.plist");
  writeFileSync(
    plist,
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key><string>en</string>
  <key>CFBundleExecutable</key><string>PocketApple</string>
  <key>CFBundleIdentifier</key><string>dev.pocket-home.PocketApple</string>
  <key>CFBundleInfoDictionaryVersion</key><string>6.0</string>
  <key>CFBundleName</key><string>PocketApple</string>
  <key>CFBundlePackageType</key><string>FMWK</string>
  <key>CFBundleShortVersionString</key><string>0.1.0</string>
  <key>CFBundleVersion</key><string>1</string>
  <key>MinimumOSVersion</key><string>${DEPLOYMENT_TARGET}</string>
</dict>
</plist>
`,
  );
  return framework;
}

/** Builds (when an input changed) and returns the path of PocketApple.xcframework. */
export function ensurePocketAppleFramework(): string {
  const hash = inputsHash();
  if (existsSync(STAMP) && existsSync(XCFRAMEWORK)) {
    const stamp = JSON.parse(readFileSync(STAMP, "utf8")) as { hash?: string };
    if (stamp.hash === hash) return XCFRAMEWORK;
  }
  console.log("pocket-apple: building PocketApple.xcframework (engine/ios-takeover)…");
  const workDir = join(OUT_DIR, "work");
  rmSync(workDir, { recursive: true, force: true });
  const frameworks = SLICES.map((slice) => buildSlice(slice, workDir));
  rmSync(XCFRAMEWORK, { recursive: true, force: true });
  mustRun([
    "xcodebuild",
    "-create-xcframework",
    ...frameworks.flatMap((framework) => ["-framework", framework]),
    "-output",
    XCFRAMEWORK,
  ]);
  writeFileSync(STAMP, JSON.stringify({ hash }, null, 2) + "\n");
  return XCFRAMEWORK;
}

/** Puts the Pocket Home build where the NativeScript project links the plugin's framework. */
export function installPocketAppleFramework(): void {
  const built = ensurePocketAppleFramework();
  const marker = join(PLUGIN_XCFRAMEWORK, "pocket-home.json");
  const want = readFileSync(STAMP, "utf8");
  if (existsSync(marker) && readFileSync(marker, "utf8") === want) return;
  if (!existsSync(join(PLUGIN_XCFRAMEWORK, ".."))) {
    throw new Error("pocket-apple: @nativescript/pocketjs is not installed in hosts/ios/app");
  }
  rmSync(PLUGIN_XCFRAMEWORK, { recursive: true, force: true });
  cpSync(built, PLUGIN_XCFRAMEWORK, { recursive: true });
  writeFileSync(marker, want);
  console.log("pocket-apple: installed Pocket Home's PocketApple.xcframework into the plugin");
}

if (import.meta.main) {
  console.log(ensurePocketAppleFramework());
}
