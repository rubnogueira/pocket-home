import { join } from "node:path";
import { validateAndResolveBuildPlan } from "@pocketjs/framework/manifest";
import { checkAppEntry } from "./app-entry-check.ts";
import { APP_DIR, PROJECT_ROOT, frameworkRoot } from "./paths.ts";
import { assertVueTypePeersHoisted } from "./vue-type-peers.ts";

assertVueTypePeersHoisted();

const manifest: unknown = await Bun.file(join(PROJECT_ROOT, "pocket.json")).json();
const result = validateAndResolveBuildPlan(manifest, { target: "web-app" });
if (!result.ok) {
  for (const d of result.diagnostics) {
    console.error(`${d.code} ${d.path || "/"}: ${d.message}`);
  }
  process.exit(1);
}

const fw = frameworkRoot();
const entry = join(PROJECT_ROOT, result.plan.app.entry);
const augment = join(APP_DIR, "types/pocket-augment.d.ts");

const typeResult = checkAppEntry({
  entry,
  tsconfigPath: join(PROJECT_ROOT, "tsconfig.json"),
  declarationFiles: [
    join(fw, "framework/src/jsx.d.ts"),
    join(fw, "framework/src/vue-sfc.d.ts"),
    augment,
  ],
});

if (!typeResult.ok) {
  for (const line of typeResult.diagnostics) console.error(line);
  process.exit(1);
}

const lintRoots = [
  APP_DIR,
  join(PROJECT_ROOT, "tools"),
  join(PROJECT_ROOT, "tests"),
  join(PROJECT_ROOT, "pocket.config.ts"),
];

const oxlint = Bun.spawnSync([process.execPath, "x", "oxlint", ...lintRoots], {
  cwd: PROJECT_ROOT,
  stdout: "inherit",
  stderr: "inherit",
});
if (oxlint.exitCode !== 0) process.exit(oxlint.exitCode ?? 1);

const oxfmt = Bun.spawnSync([process.execPath, "x", "oxfmt", "--check", ...lintRoots], {
  cwd: PROJECT_ROOT,
  stdout: "inherit",
  stderr: "inherit",
});
if (oxfmt.exitCode !== 0) process.exit(oxfmt.exitCode ?? 1);

const tsc = Bun.spawnSync([process.execPath, "x", "tsc", "-p", "tsconfig.json", "--noEmit"], {
  cwd: PROJECT_ROOT,
  stdout: "inherit",
  stderr: "inherit",
});
if (tsc.exitCode !== 0) process.exit(tsc.exitCode ?? 1);

console.log("✓ vue type peers hoisted");
console.log("✓ pocket.json v2");
console.log("✓ web-app satisfies pocket.json capabilities");
console.log(`✓ TypeScript (${typeResult.checkedFiles.length} app entry file(s) + graph)`);
console.log("✓ oxlint");
console.log("✓ oxfmt");
console.log("✓ TypeScript (app + tools)");
console.log(`✓ ResolvedBuildPlan ${result.plan.planHash}`);
