#!/usr/bin/env node
/** Point node_modules/.bin/ns (and aliases) at pocket-ns so bare `bunx ns` gets Ruby + TS shims. */
const fs = require("node:fs");
const path = require("node:path");

const shellRoot = path.join(__dirname, "..");
const binDir = path.join(shellRoot, "node_modules", ".bin");
const pocketNs = path.join(__dirname, "pocket-ns.cjs");
const rubyShim = path.join(__dirname, "ruby-shim", "ruby");

if (!fs.existsSync(binDir) || !fs.existsSync(pocketNs)) {
  process.exit(0);
}

try {
  require(pocketNs).restoreNativeScriptBin?.();
} catch {
  // ignore
}

try {
  fs.chmodSync(rubyShim, 0o755);
} catch {
  // ignore
}

const launcher = `#!/usr/bin/env node
require(${JSON.stringify(pocketNs)}).runNs(process.argv.slice(2));
`;

for (const name of ["ns", "tns", "nativescript", "nsc"]) {
  const target = path.join(binDir, name);
  try {
    fs.writeFileSync(target, launcher);
    fs.chmodSync(target, 0o755);
  } catch (err) {
    console.warn(`install-cli-shims: could not write ${target}:`, err.message);
  }
}
