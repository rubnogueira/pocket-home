import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { IOS_APP_SHELL } from "../ios/paths.ts";

const SHELL_DIR = IOS_APP_SHELL;
const PLATFORM_APP = join(SHELL_DIR, "platforms/ios/iossimulator/app");
const STAGED_POCKET = join(SHELL_DIR, "src/assets/pocket");

export function listPocketAssetNames(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).sort();
}

function readStagedAppName(): string {
  const currentPath = join(STAGED_POCKET, "current.json");
  if (!existsSync(currentPath)) {
    throw new Error("ios-app: missing src/assets/pocket/current.json — run guest build/staging");
  }
  return (JSON.parse(readFileSync(currentPath, "utf8")) as { app: string }).app;
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
  verifyPocketGuestAssets(destDir, readStagedAppName());
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

export function verifyPocketGuestAssets(pocketDir: string, appName: string): void {
  const pak = join(pocketDir, `${appName}.pak`);
  const bundle = join(pocketDir, `${appName}.pocketjs`);
  const plan = join(pocketDir, `${appName}.plan.json`);
  const missing: string[] = [];
  if (!existsSync(pak)) missing.push(pak);
  if (!existsSync(bundle)) missing.push(bundle);
  if (!existsSync(plan)) missing.push(plan);
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
  const pocketDir = join(appFolder, "assets/pocket");
  verifyPocketGuestAssets(pocketDir, readStagedAppName());
}

export function diagnoseIosAppStaging(): { ok: boolean; lines: string[] } {
  const lines: string[] = [];
  let ok = true;
  const appName = existsSync(join(STAGED_POCKET, "current.json"))
    ? readStagedAppName()
    : "(unknown)";

  for (const [label, dir] of [
    ["staged src", STAGED_POCKET],
    ["platform app", join(PLATFORM_APP, "assets/pocket")],
    [
      "installed .app",
      join(
        SHELL_DIR,
        "platforms/ios/build/Debug-iphonesimulator/iossimulator.app/app/assets/pocket",
      ),
    ],
  ] as const) {
    const names = listPocketAssetNames(dir);
    const hasPak = appName !== "(unknown)" && existsSync(join(dir, `${appName}.pak`));
    lines.push(`${label}: ${names.join(", ") || "(missing dir)"}${hasPak ? "" : " — NO .pak"}`);
    if (!hasPak) ok = false;
  }

  const builtBundle = join(
    SHELL_DIR,
    "platforms/ios/build/Debug-iphonesimulator/iossimulator.app/app/bundle.js",
  );
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
