// Wasm + app build + browser dev server.
//
//   bun tools/dev.ts [--density=2] [--hz=240] [--outdir=dist]
import { join } from "node:path";
import { PROJECT_ROOT } from "./paths.ts";

function run(cmd: string[]): void {
  console.log(`dev: ${cmd.join(" ")}`);
  const p = Bun.spawnSync(cmd, { cwd: PROJECT_ROOT, stdout: "inherit", stderr: "inherit" });
  if (p.exitCode !== 0) process.exit(p.exitCode ?? 1);
}

const buildArgs = process.argv.slice(2).filter((a) => a.startsWith("--"));

run([process.execPath, join(PROJECT_ROOT, "tools/wasm.ts")]);
run([process.execPath, join(PROJECT_ROOT, "tools/build.ts"), ...buildArgs]);

await import("./serve.ts");
