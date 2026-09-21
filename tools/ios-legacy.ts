// Legacy / exact-device iOS stacks (iOS 6, iPod touch, …) — guest builds from pocket-home;
// native .app for iOS 6 delegates to @pocketjs/framework tools when sysroot is ready.
//
//   bun tools/ios-legacy.ts list
//   bun tools/ios-legacy.ts build-guest <stack-id>
//   bun tools/ios-legacy.ts build-guest-all
//   bun tools/ios-legacy.ts native <stack-id>   # framework toolchain (iphone4s, ipodtouch, …)
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { extractHostBuildInputs } from "@pocketjs/framework/manifest";
import { frameworkRoot, PROJECT_ROOT } from "./paths.ts";
import { resolveLegacyPlan, type LegacyProfileId } from "./ios-legacy/profiles.ts";
import {
  buildableLegacyStacks,
  legacyStacks,
  manifestForStack,
  resolveLegacyStack,
  stackGuestDir,
  stackPlanPath,
} from "./ios-legacy/stacks.ts";

function mustRun(executable: string, args: readonly string[]): void {
  const result = Bun.spawnSync({
    cmd: [executable, ...args],
    cwd: PROJECT_ROOT,
    stdout: "inherit",
    stderr: "inherit",
  });
  if (result.exitCode !== 0) process.exit(result.exitCode ?? 1);
}

function manifestPath(): string {
  return join(PROJECT_ROOT, "pocket.json");
}

async function buildGuest(stackId: string): Promise<void> {
  const stack = resolveLegacyStack(stackId);
  if (stack.unsupportedReason) {
    throw new Error(`ios-legacy: ${stack.id} is unsupported — ${stack.unsupportedReason}`);
  }
  if (!stack.profile) {
    throw new Error(`ios-legacy: stack ${stack.id} has no profile`);
  }
  const productType = process.env.POCKET_IOS_DEVICE_PROFILE;
  const manifest = manifestForStack(stack, manifestPath(), productType);
  const plan = resolveLegacyPlan(manifest, stack.profile as LegacyProfileId);
  const planPath = stackPlanPath(stackId);
  mkdirSync(dirname(planPath), { recursive: true });
  writeFileSync(planPath, JSON.stringify(plan, null, 2) + "\n");

  const guestDir = stackGuestDir(stackId);
  rmSync(guestDir, { recursive: true, force: true });
  mkdirSync(guestDir, { recursive: true });
  mustRun(process.execPath, [
    join(PROJECT_ROOT, "tools/build.ts"),
    `--plan=${planPath}`,
    `--project-root=${PROJECT_ROOT}`,
    `--outdir=${guestDir}`,
    "--hz=60",
  ]);

  const inputs = extractHostBuildInputs(plan);
  const js = join(guestDir, `${inputs.appOutput}.js`);
  const pak = join(guestDir, `${inputs.appOutput}.pak`);
  if (!existsSync(js) || !existsSync(pak)) {
    throw new Error(`ios-legacy: guest build missing artifacts for ${stackId}`);
  }
  console.log(`ios-legacy: built guest for ${stackId} → ${guestDir}`);
}

async function buildGuestAll(): Promise<void> {
  for (const stack of buildableLegacyStacks()) {
    await buildGuest(stack.id);
  }
}

async function nativeStack(stackId: string): Promise<void> {
  const stack = resolveLegacyStack(stackId);
  if (stack.nativeTier) {
    await buildGuest(stackId);
    mustRun(process.execPath, ["tools/ios-native.ts", `--tier=${stack.nativeTier}`, "build"]);
    console.log(
      `ios-legacy: built ios-native tier ${stack.nativeTier} — deploy with POCKET_IOS_TIER=${stack.nativeTier}`,
    );
    return;
  }
  if (!stack.frameworkNativeTool) {
    throw new Error(stack.unsupportedReason ?? `ios-legacy: no native toolchain for ${stackId}`);
  }
  await buildGuest(stackId);
  const fw = frameworkRoot();
  const tool = join(fw, "tools", `${stack.frameworkNativeTool}.ts`);
  if (!existsSync(tool)) {
    throw new Error(`ios-legacy: framework tool missing at ${tool}`);
  }
  console.log(`ios-legacy: Pocket Home guest is in ${stackGuestDir(stackId)}`);
  console.log(
    `Native .app for ${stack.label} uses the PocketJS "${stack.frameworkNativeTool}" host in the framework checkout.`,
  );
  console.log(`  cd ${fw}`);
  console.log(`  bun ${stack.frameworkNativeTool} doctor`);
  console.log(
    `  bun ${stack.frameworkNativeTool} build   # link step; guest must use pocket-home plan — see docs/IOS_VERSION_MATRIX.md`,
  );
}

function list(): void {
  console.log("Legacy iOS stacks:\n");
  for (const stack of legacyStacks()) {
    const status = stack.unsupportedReason
      ? `unsupported — ${stack.unsupportedReason}`
      : stack.profile
        ? `guest profile=${stack.profile} viewport=${stack.logicalViewport.join("x")}`
        : "no profile";
    console.log(`  ${stack.id}  iOS ${stack.iosMin}–${stack.iosMax}`);
    console.log(`    ${stack.label}`);
    console.log(`    ${status}\n`);
  }
}

function help(): void {
  console.log(`Usage: bun tools/ios-legacy.ts <command>

Commands:
  list
  build-guest <stack-id>
  build-guest-all
  native <stack-id>
`);
}

const [command, ...rest] = Bun.argv.slice(2);

switch (command) {
  case "list":
    list();
    break;
  case "build-guest":
    if (!rest[0]) {
      help();
      process.exit(1);
    }
    await buildGuest(rest[0]);
    break;
  case "build-guest-all":
    await buildGuestAll();
    break;
  case "native":
    if (!rest[0]) {
      help();
      process.exit(1);
    }
    await nativeStack(rest[0]);
    break;
  default:
    help();
    if (command !== "help" && command !== undefined) process.exit(1);
}
