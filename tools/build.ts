// Build pocket-home-main (Vue Vapor bundle + pak).
//
//   bun tools/build.ts [--density=2] [--hz=240] [--outdir=dist]
//
// Without --density (web builds), one bundle + pak is baked per raster density the browser host
// can pick (hosts/web/engine.js autoDensity: ceil(devicePixelRatio), 1..3):
//   dist/density/<d>/pocket-home-main.vue-vapor.{js,pak}   d = 1, 2, 3
//   dist/pocket-home-main.vue-vapor.{js,pak}               = the 2x build (default / other hosts)
// Glyph atlases and icons are rasterized at build time, so this is what keeps text sharp on
// 1x, 2x and 3x screens alike. --density=N builds just that density into --outdir.
//   bun tools/build.ts --plan=.pocket/ios-native/<tier>/pocket-home.plan.json --outdir=dist/ios-native/<tier>/guest
import { copyFileSync, existsSync, mkdirSync, renameSync } from "node:fs";
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

const explicitDensity = buildExtra.some((a) => a.startsWith("--density="));
const hzArgs = buildExtra.some((a) => a.startsWith("--hz=")) ? [] : ["--hz=240"];

if (planArg && existsSync(join(APP_DIR, "icons/manifest.json"))) {
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

/** One web build at `density` into `outdir` (icons are regenerated at that density first). */
async function buildWeb(density: number, outdir: string): Promise<void> {
  mkdirSync(outdir, { recursive: true });
  if (existsSync(join(APP_DIR, "icons/manifest.json"))) {
    await generateHaIcons({ appDir: PROJECT_ROOT, rasterDensity: density });
  }
  run([
    process.execPath,
    join(fw, "tools/build.ts"),
    join(PROJECT_ROOT, "app/main.tsx"),
    `--project-root=${PROJECT_ROOT}`,
    `--outdir=${outdir}`,
    `--framework=${manifestFramework}`,
    `--density=${density}`,
    ...hzArgs,
    ...buildExtra.filter((a) => !a.startsWith("--density=")),
  ]);
  for (const ext of [".vue-vapor.js", ".vue-vapor.pak"]) {
    const from = join(outdir, `main${ext}`);
    const to = join(outdir, `${OUTPUT}${ext}`);
    if (existsSync(from)) renameSync(from, to);
  }
}

if (explicitDensity) {
  // Explicit --density: that density only.
  await buildWeb(rasterDensity, dist);
} else {
  // Default 2x last, so app/icons/generated ends at the default density.
  const DEFAULT_DENSITY = 2;
  for (const density of [1, 3, DEFAULT_DENSITY]) {
    await buildWeb(density, join(dist, "density", String(density)));
  }
  for (const ext of [".vue-vapor.js", ".vue-vapor.pak"]) {
    copyFileSync(
      join(dist, "density", String(DEFAULT_DENSITY), `${OUTPUT}${ext}`),
      join(dist, `${OUTPUT}${ext}`),
    );
  }
}
