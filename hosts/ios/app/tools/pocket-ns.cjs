#!/usr/bin/env node
/**
 * NativeScript CLI with Pocket Home ios-app env:
 * - GEM_PATH + ruby-shim so `ruby -e "require 'xcodeproj'"` works (Bundler vendor gems)
 * - NODE_OPTIONS typescript-webpack shim (TS 7 vs ts-loader)
 */
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const shellRoot = path.join(__dirname, "..");
const tnsCli = path.join(shellRoot, "node_modules", "nativescript", "lib", "nativescript-cli.js");
const tsShim = path.join(shellRoot, "tools", "typescript-webpack-shim.cjs");
const rubyShimDir = path.join(shellRoot, "tools", "ruby-shim");

function nodeBin() {
  return process.env.POCKET_NS_NODE || "node";
}

/** Upstream `bin/tns` — do not point at `.bin/ns` shims (infinite recursion). */
function restoreNativeScriptBin() {
  const tnsBin = path.join(shellRoot, "node_modules", "nativescript", "bin", "tns");
  const expected = `#!/usr/bin/env node

require("../lib/nativescript-cli.js");
`;
  try {
    if (!fs.existsSync(tnsBin)) return;
    const current = fs.readFileSync(tnsBin, "utf8");
    if (current.includes("pocket-ns.cjs")) {
      fs.writeFileSync(tnsBin, expected);
      fs.chmodSync(tnsBin, 0o755);
    }
  } catch {
    // ignore
  }
}

function runBundle(args, inherit) {
  return spawnSync("bundle", args, {
    cwd: shellRoot,
    encoding: "utf8",
    stdio: inherit ? "inherit" : "pipe",
    env: process.env,
  });
}

function ensureBundlerGems() {
  const gemfile = path.join(shellRoot, "Gemfile");
  if (!fs.existsSync(gemfile)) {
    return;
  }
  const check = runBundle(["check"], false);
  if (check.status === 0) {
    return;
  }
  runBundle(["config", "set", "--local", "path", "vendor/bundle"], true);
  const install = runBundle(["install"], true);
  if (install.status !== 0) {
    console.error("pocket-ns: bundle install failed in hosts/ios/app");
    process.exit(1);
  }
}

function pocketEnv(baseEnv = process.env) {
  ensureBundlerGems();

  let gemPath = baseEnv.GEM_PATH ?? "";
  if (!gemPath) {
    const paths = runBundle(["exec", "ruby", "-e", "puts Gem.path.join(':')"], false);
    if (paths.status === 0 && paths.stdout) {
      gemPath = paths.stdout.trim();
    }
  }

  return {
    ...baseEnv,
    ...(gemPath ? { GEM_PATH: gemPath } : {}),
    PATH: pathPrefix,
  };
}

function runNs(argv) {
  restoreNativeScriptBin();
  if (!fs.existsSync(tnsCli)) {
    console.error("pocket-ns: nativescript not installed — run bun install in hosts/ios/app");
    process.exit(1);
  }
  const env = pocketEnv();
  const result = spawnSync(nodeBin(), [tnsCli, ...argv], {
    cwd: shellRoot,
    stdio: "inherit",
    env,
  });
  process.exit(result.status ?? 1);
}

if (require.main === module) {
  runNs(process.argv.slice(2));
}

module.exports = { pocketEnv, runNs, restoreNativeScriptBin, shellRoot, tnsCli };
