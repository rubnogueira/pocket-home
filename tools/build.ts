// Build pocket-home-main (Vue Vapor bundle + pak).
//
//   bun tools/build.ts [--density=2] [--hz=240] [--outdir=dist]
//   bun tools/build.ts --plan=.pocket/ios-native/<tier>/pocket-home.plan.json --outdir=dist/ios-native/<tier>/guest
import { existsSync, renameSync } from "node:fs";
import { join, resolve } from "node:path";
import { APP_DIR, frameworkRoot, PROJECT_ROOT } from "./paths.ts";
import { ensureFrameworkDeps } from "./ensure-framework-deps.ts";
import { generateHaIcons } from "./generate-ha-icons.ts";

ensureFrameworkDeps();

const OUTPUT = "pocket-home-main";
const fw = frameworkRoot();
const manifest: { app?: { framework?: string } } = await Bun.file(
  join(PROJECT_ROOT, "pocket.json"),
).json();
const manifestFramework = manifest.app?.framework ?? "vue-vapor";
const extra = process.argv.slice(2);
const planArg = extra.find((a) => a.startsWith("--plan="));

let dist = join(PROJECT_ROOT, "dist");
for (const a of extra) {
  if (a.startsWith("--outdir=")) dist = resolve(a.slice("--outdir=".length));
}
const buildExtra = extra.filter((a) => !a.startsWith("--outdir="));

let rasterDensity = 2;
if (planArg) {
  const plan = await Bun.file(resolve(planArg.slice("--plan=".length))).json();
  rasterDensity = plan.viewport?.rasterDensity ?? 1;
} else {
  const densityFlag = buildExtra.find((a) => a.startsWith("--density="));
  rasterDensity = densityFlag ? Number(densityFlag.slice("--density=".length)) : 2;
}

const densityArgs = planArg
  ? []
  : buildExtra.some((a) => a.startsWith("--density="))
    ? []
    : ["--density=2"];
const hzArgs = buildExtra.some((a) => a.startsWith("--hz=")) ? [] : ["--hz=240"];

if (existsSync(join(APP_DIR, "icons/manifest.json"))) {
  await generateHaIcons({ appDir: PROJECT_ROOT, rasterDensity });
}

function run(args: string[]): void {
  const p = Bun.spawnSync(args, { cwd: PROJECT_ROOT, stdout: "inherit", stderr: "inherit" });
  if (p.exitCode !== 0) process.exit(p.exitCode ?? 1);
}

if (planArg) {
  run([
    process.execPath,
    join(fw, "tools/build.ts"),
    `--project-root=${PROJECT_ROOT}`,
    `--outdir=${dist}`,
    ...buildExtra,
  ]);
  process.exit(0);
}

run([
  process.execPath,
  join(fw, "tools/build.ts"),
  join(PROJECT_ROOT, "app/main.tsx"),
  `--project-root=${PROJECT_ROOT}`,
  `--outdir=${dist}`,
  `--framework=${manifestFramework}`,
  ...densityArgs,
  ...hzArgs,
  ...buildExtra,
]);

for (const ext of [".vue-vapor.js", ".vue-vapor.pak"]) {
  const from = join(dist, `main${ext}`);
  const to = join(dist, `${OUTPUT}${ext}`);
  if (existsSync(from)) renameSync(from, to);
}
