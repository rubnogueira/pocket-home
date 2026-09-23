import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { IOS_APP_SHELL, iosAppSimulatorProduct } from "../ios/paths.ts";

const SHELL_DIR = IOS_APP_SHELL;
const PLATFORM_APP = join(SHELL_DIR, "platforms/ios/iossimulator/app");
const STAGED_POCKET = join(SHELL_DIR, "src/assets/pocket");

export function listPocketAssetNames(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).sort();
}

interface StagedCurrent {
  app: string;
  variants?: { density: number; tickHz: number; bundle: string; pak: string }[];
}

function readStaged(dir: string = STAGED_POCKET): StagedCurrent {
  const currentPath = join(dir, "current.json");
  if (!existsSync(currentPath)) {
    throw new Error(`ios-app: missing ${currentPath} — run guest build/staging`);
  }
  return JSON.parse(readFileSync(currentPath, "utf8")) as StagedCurrent;
}

/** Every file a staged guest needs: bundle per variant, pak + plan per density. */
function stagedGuestFiles(current: StagedCurrent): string[] {
  const variants = current.variants ?? [];
  if (variants.length === 0) {
    return [`${current.app}.pocketjs`, `${current.app}.pak`, `${current.app}.plan.json`];
  }
  const files = new Set<string>();
  for (const v of variants) {
    files.add(`${v.bundle}.pocketjs`);
    files.add(`${v.pak}.pak`);
    files.add(`${v.pak}.plan.json`);
  }
  return [...files];
}

/** Mirror staged guest assets into the NativeScript `platforms/.../app/assets/pocket` tree (webpack often skips `.pak`). */
export function syncStagedPocketIntoPlatformApp(): void {
  if (!existsSync(STAGED_POCKET)) {
    throw new Error("ios-app: missing src/assets/pocket — run guest build/staging first");
  }
  const destDir = join(PLATFORM_APP, "assets/pocket");
  mkdirSync(destDir, { recursive: true });
  for (const name of readdirSync(STAGED_POCKET)) {
    cpSync(join(STAGED_POCKET, name), join(destDir, name), { force: true });
  }
  verifyPocketGuestAssets(destDir);
}

/** Xcode copies the `app` folder by reference; incremental builds keep stale bundle.js/assets inside `.app`. */
export function syncPlatformAppIntoBuiltBundle(appPath: string): void {
  if (!existsSync(PLATFORM_APP)) {
    throw new Error(`ios-app: missing ${PLATFORM_APP} — run webpack first`);
  }
  syncStagedPocketIntoPlatformApp();
  const dest = join(appPath, "app");
  mkdirSync(dest, { recursive: true });
  cpSync(PLATFORM_APP, dest, { recursive: true, force: true });
  verifyRuntimeAppFolder(dest);
}

export function verifyPocketGuestAssets(pocketDir: string): void {
  const missing = stagedGuestFiles(readStaged(pocketDir))
    .map((name) => join(pocketDir, name))
    .filter((path) => !existsSync(path));
  if (missing.length > 0) {
    throw new Error(
      `ios-app: incomplete pocket guest in ${pocketDir} — missing:\n  ${missing.join("\n  ")}\n` +
        `(re-run \`bun tools/ios-app.ts build\` — guest must produce .js + .pak)`,
    );
  }
}

/** Guard against shipping an ancient shell bundle (pre sync-native-app). */
export function verifyRuntimeAppFolder(appFolder: string): void {
  const bundlePath = join(appFolder, "bundle.js");
  if (!existsSync(bundlePath)) {
    throw new Error(`ios-app: missing ${bundlePath} in built .app`);
  }
  // The NativeScript runtime resolves `app/package.json#main`; without it boot aborts.
  const packagePath = join(appFolder, "package.json");
  if (!existsSync(packagePath)) {
    throw new Error(`ios-app: missing ${packagePath} in built .app (runtime cannot find main)`);
  }
  const pocketDir = join(appFolder, "assets/pocket");
  verifyPocketGuestAssets(pocketDir);
}

export function diagnoseIosAppStaging(): { ok: boolean; lines: string[] } {
  const lines: string[] = [];
  let ok = true;
  const expected = existsSync(join(STAGED_POCKET, "current.json"))
    ? stagedGuestFiles(readStaged())
    : null;

  for (const [label, dir] of [
    ["staged src", STAGED_POCKET],
    ["platform app", join(PLATFORM_APP, "assets/pocket")],
    ["installed .app", join(iosAppSimulatorProduct("Debug"), "app/assets/pocket")],
  ] as const) {
    const names = listPocketAssetNames(dir);
    const missing = expected
      ? expected.filter((name) => !existsSync(join(dir, name)))
      : ["current.json"];
    lines.push(
      `${label}: ${names.join(", ") || "(missing dir)"}${missing.length ? ` — MISSING ${missing.join(", ")}` : ""}`,
    );
    if (missing.length) ok = false;
  }

  const builtBundle = join(iosAppSimulatorProduct("Debug"), "app/bundle.js");
  const platformBundle = join(PLATFORM_APP, "bundle.js");
  if (existsSync(builtBundle) && existsSync(platformBundle)) {
    const staleByTime = statSync(builtBundle).mtimeMs < statSync(platformBundle).mtimeMs - 1000;
    lines.push(
      `bundle.js: platform mtime ${statSync(platformBundle).mtimeMs} vs .app ${statSync(builtBundle).mtimeMs}${
        staleByTime ? " — STALE in .app (run ios again; sync runs after xcodebuild)" : " — ok"
      }`,
    );
    if (staleByTime) ok = false;
  }

  return { ok, lines };
}

const APP_RESOURCES_IOS = join(SHELL_DIR, "App_Resources/iOS");
const PLATFORM_RESOURCES = join(SHELL_DIR, "platforms/ios/iossimulator/Resources");
const PLATFORM_INFO_PLIST = join(SHELL_DIR, "platforms/ios/iossimulator/iossimulator-Info.plist");

function readPlistJson(path: string): Record<string, unknown> {
  const result = Bun.spawnSync(["plutil", "-convert", "json", "-o", "-", path]);
  if (result.exitCode !== 0) {
    throw new Error(`ios-app: cannot read ${path}: ${result.stderr.toString().trim()}`);
  }
  return JSON.parse(result.stdout.toString()) as Record<string, unknown>;
}

/**
 * `ns prepare` copies App_Resources/iOS into the platform project, and tools/ios-app.ts only runs
 * prepare when the platform is missing — so edits to the launch screen, asset catalog,
 * build.xcconfig or Info.plist never reached the build (the launch screen kept its old colour).
 * Sources under App_Resources/iOS/src are referenced in place and need no copy.
 *
 * Info.plist is merged, not copied: the platform copy carries keys NativeScript adds
 * (CFBundleIdentifier, URL scheme); App_Resources values win for every key they define.
 */
export function syncAppResourcesIntoPlatform(): string[] {
  const changed: string[] = [];
  if (!existsSync(PLATFORM_RESOURCES)) return changed;

  for (const name of ["LaunchScreen.storyboard", "build.xcconfig"]) {
    const from = join(APP_RESOURCES_IOS, name);
    const to = join(PLATFORM_RESOURCES, name);
    if (!existsSync(from)) continue;
    const next = readFileSync(from, "utf8");
    const current = existsSync(to) ? readFileSync(to, "utf8") : "";
    // build.xcconfig gains NS_SWIFTUI_BOOT in the platform copy (ensureSwiftUiBoot…); compare
    // without it so an unchanged source is not rewritten on every run.
    const normalize = (text: string) =>
      text
        .split("\n")
        .filter((line) => !line.startsWith("NS_SWIFTUI_BOOT"))
        .join("\n")
        .trim();
    if (normalize(next) !== normalize(current)) {
      writeFileSync(to, next);
      changed.push(name);
    }
  }

  const assetsFrom = join(APP_RESOURCES_IOS, "Assets.xcassets");
  const assetsTo = join(PLATFORM_RESOURCES, "Assets.xcassets");
  if (existsSync(assetsFrom)) {
    rmSync(assetsTo, { recursive: true, force: true });
    cpSync(assetsFrom, assetsTo, { recursive: true });
  }

  const infoFrom = join(APP_RESOURCES_IOS, "Info.plist");
  if (existsSync(infoFrom) && existsSync(PLATFORM_INFO_PLIST)) {
    const platform = readPlistJson(PLATFORM_INFO_PLIST);
    const merged = { ...platform, ...readPlistJson(infoFrom) };
    if (JSON.stringify(merged) !== JSON.stringify(platform)) {
      const tmp = `${PLATFORM_INFO_PLIST}.json`;
      writeFileSync(tmp, JSON.stringify(merged));
      const result = Bun.spawnSync(["plutil", "-convert", "xml1", "-o", PLATFORM_INFO_PLIST, tmp]);
      rmSync(tmp, { force: true });
      if (result.exitCode !== 0) {
        throw new Error(`ios-app: cannot write ${PLATFORM_INFO_PLIST}`);
      }
      changed.push("Info.plist");
    }
  }
  return changed;
}
