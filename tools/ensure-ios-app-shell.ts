import { existsSync } from "node:fs";
import { join } from "node:path";
import { ensureIosRubyGems } from "./ensure-ios-ruby.ts";
import { IOS_APP_SHELL } from "./ios/paths.ts";

const SHELL_DIR = IOS_APP_SHELL;

function shellDepsReady(): boolean {
  return (
    existsSync(join(SHELL_DIR, "node_modules", "nativescript")) &&
    existsSync(join(SHELL_DIR, "node_modules", "@nativescript", "webpack", "dist", "index.js"))
  );
}

function installCliShims(): void {
  for (const script of [
    "install-cli-shims.cjs",
    "patch-webpack-exit.cjs",
    "patch-nativescript-bundler.cjs",
  ]) {
    const shims = Bun.spawnSync({
      cmd: [process.execPath, join(SHELL_DIR, "tools", script)],
      cwd: SHELL_DIR,
      stdout: "inherit",
      stderr: "inherit",
    });
    if (shims.exitCode !== 0) {
      throw new Error(`Pocket Home: ${script} failed in hosts/ios/app`);
    }
  }
}

export function ensureIosAppShell(): void {
  if (!existsSync(join(SHELL_DIR, "package.json"))) {
    throw new Error("Pocket Home: missing hosts/ios/app (NativeScript shell)");
  }
  if (shellDepsReady()) {
    ensureIosRubyGems();
    installCliShims();
    return;
  }

  // Not in the root Bun workspace — NativeScript/webpack need a flat install tree in this directory.
  const result = Bun.spawnSync({
    cmd: ["bun", "install"],
    cwd: SHELL_DIR,
    stdout: "inherit",
    stderr: "inherit",
  });
  if (result.exitCode !== 0 || !shellDepsReady()) {
    throw new Error(
      "Pocket Home: bun install failed in hosts/ios/app — run `bun install` in that directory",
    );
  }
  ensureIosRubyGems();
  installCliShims();
}

if (import.meta.main) {
  ensureIosAppShell();
}
