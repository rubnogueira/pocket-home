// Build the PocketJS browser wasm core (delegates to @pocketjs/framework).
import { join } from "node:path";
import { frameworkRoot } from "./paths.ts";

const fw = frameworkRoot();
const child = Bun.spawnSync([process.execPath, join(fw, "tools/wasm.ts")], {
  cwd: fw,
  stdout: "inherit",
  stderr: "inherit",
});
process.exit(child.exitCode ?? 1);
