// Build the browser wasm core: engine/web (the framework's engine/wasm source + GPU exports,
// see engine/web/src/lib.rs) -> hosts/web/pocketjs.wasm, which tools/serve.ts serves in place
// of the framework's prebuilt one.
//
//   bun tools/wasm.ts
//
// Needs the wasm target: rustup target add wasm32-unknown-unknown
import { existsSync } from "node:fs";
import { delimiter, join } from "node:path";
import { homedir } from "node:os";
import { PROJECT_ROOT } from "./paths.ts";

const CRATE = join(PROJECT_ROOT, "engine/web");
const BUILT = join(CRATE, "target/wasm32-unknown-unknown/release/pocket_home_wasm.wasm");
const OUT = join(PROJECT_ROOT, "hosts/web/pocketjs.wasm");

const env = {
  ...process.env,
  // cargo lives in ~/.cargo/bin, which non-login shells may not have on PATH.
  PATH: `${join(homedir(), ".cargo/bin")}${delimiter}${process.env.PATH ?? ""}`,
  // SIMD + the post-MVP features every current browser ships; ~20% off raster time.
  RUSTFLAGS: "-C target-feature=+simd128,+bulk-memory,+nontrapping-fptoint,+sign-ext",
};

const build = Bun.spawnSync(["cargo", "build", "--release", "--target", "wasm32-unknown-unknown"], {
  cwd: CRATE,
  env,
  stdout: "inherit",
  stderr: "inherit",
});
if (build.exitCode !== 0) {
  console.error(
    "pocket-home wasm: cargo build failed (missing target? rustup target add wasm32-unknown-unknown)",
  );
  process.exit(build.exitCode ?? 1);
}
if (!existsSync(BUILT)) {
  console.error(`pocket-home wasm: build succeeded but ${BUILT} is missing`);
  process.exit(1);
}
const bytes = await Bun.file(BUILT).arrayBuffer();
await Bun.write(OUT, bytes);
console.log(
  `pocket-home wasm: hosts/web/pocketjs.wasm (${(bytes.byteLength / 1024).toFixed(1)} KiB)`,
);
