import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { IOS_APP_SHELL } from "./ios/paths.ts";

const SHELL_DIR = IOS_APP_SHELL;
const GEMFILE = join(SHELL_DIR, "Gemfile");

function run(cmd: string, args: string[], cwd: string): { exitCode: number; stdout: string } {
  const result = Bun.spawnSync({
    cmd: [cmd, ...args],
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  return { exitCode: result.exitCode, stdout: result.stdout.toString().trim() };
}

export function ensureIosRubyGems(): void {
  if (!existsSync(GEMFILE)) return;

  const bundle = Bun.which("bundle");
  if (!bundle) {
    throw new Error(
      "Pocket Home: Ruby Bundler not found — install Ruby (Xcode CLI tools or mise/asdf) and run `gem install bundler`",
    );
  }

  const check = run(bundle, ["check"], SHELL_DIR);
  if (check.exitCode !== 0) {
    const install = Bun.spawnSync({
      cmd: [bundle, "config", "set", "--local", "path", "vendor/bundle"],
      cwd: SHELL_DIR,
      stdout: "inherit",
      stderr: "inherit",
    });
    if (install.exitCode !== 0) {
      throw new Error("Pocket Home: bundle config failed in hosts/ios/app");
    }
    const result = Bun.spawnSync({
      cmd: [bundle, "install"],
      cwd: SHELL_DIR,
      stdout: "inherit",
      stderr: "inherit",
    });
    if (result.exitCode !== 0) {
      throw new Error(
        "Pocket Home: bundle install failed in hosts/ios/app — run `bundle install` there",
      );
    }
    resetIosAppRubyEnvCache();
  }
}

/** GEM_PATH so plain `ruby -e "require 'xcodeproj'"` (NativeScript) finds vendor gems. Cached — `bundle exec ruby` is slow. */
let cachedRubyEnv: Record<string, string | undefined> | null = null;

export function iosAppRubyEnv(): Record<string, string | undefined> {
  if (cachedRubyEnv !== null) {
    return cachedRubyEnv;
  }
  if (!existsSync(GEMFILE)) {
    cachedRubyEnv = {};
    return cachedRubyEnv;
  }
  const bundle = Bun.which("bundle");
  if (!bundle) {
    cachedRubyEnv = {};
    return cachedRubyEnv;
  }

  try {
    ensureIosRubyGems();
  } catch {
    cachedRubyEnv = {};
    return cachedRubyEnv;
  }

  const gemPath = gemPathFromVendorBundle(SHELL_DIR);
  if (gemPath) {
    cachedRubyEnv = { GEM_PATH: gemPath };
    return cachedRubyEnv;
  }

  cachedRubyEnv = {};
  return cachedRubyEnv;
}

/** Avoid `bundle exec ruby` on every launch (Bundler can hang for minutes). */
function gemPathFromVendorBundle(cwd: string): string | undefined {
  const rubyRoot = join(cwd, "vendor/bundle/ruby");
  if (!existsSync(rubyRoot)) return undefined;
  const segments: string[] = [];
  for (const ver of readdirSync(rubyRoot)) {
    const base = join(rubyRoot, ver);
    for (const sub of ["gems", "specifications", "extensions"]) {
      const dir = join(base, sub);
      if (existsSync(dir)) segments.push(dir);
    }
  }
  return segments.length > 0 ? segments.join(":") : undefined;
}

export function resetIosAppRubyEnvCache(): void {
  cachedRubyEnv = null;
}

if (import.meta.main) {
  ensureIosRubyGems();
}
