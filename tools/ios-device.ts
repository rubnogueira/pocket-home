// USB device detection and auto build/deploy routing.
//
//   bun tools/ios-device.ts detect
//   bun tools/ios-device.ts ship [--build] [--udid=]
import { probeUsbDevice } from "./ios/device-probe.ts";
import { resolveDeployTarget } from "./ios/resolve-deploy-target.ts";
import { resolveIosNativeTier } from "./ios-native/tiers.ts";
import { resolveLegacyStack } from "./ios-legacy/stacks.ts";
import { PROJECT_ROOT } from "./paths.ts";
import { join } from "node:path";

function flagValue(args: readonly string[], name: string): string | undefined {
  const inline = args.find((a) => a.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

function mustRun(executable: string, args: readonly string[]): void {
  const result = Bun.spawnSync({
    cmd: [executable, ...args],
    cwd: PROJECT_ROOT,
    stdout: "inherit",
    stderr: "inherit",
  });
  if (result.exitCode !== 0) process.exit(result.exitCode ?? 1);
}

async function detect(udid?: string): Promise<void> {
  const device = probeUsbDevice(udid);
  const target = resolveDeployTarget(device);
  console.log(JSON.stringify({ device, target }, null, 2));
  console.log(`\n→ ${target.summary}`);
}

async function ship(args: readonly string[]): Promise<void> {
  const udid = flagValue(args, "--udid");
  const forceBuild = args.includes("--build");
  const device = probeUsbDevice(udid);
  const target = resolveDeployTarget(device);
  console.log(`ios-device: ${target.summary}`);

  if (target.kind === "legacy-stack") {
    process.env.POCKET_IOS_DEVICE_PROFILE = device.productType;
    process.env.POCKET_IOS_LEGACY_LOGICAL = target.legacyLogical.join(",");
    mustRun(process.execPath, [
      join(PROJECT_ROOT, "tools/ios-legacy.ts"),
      "build-guest",
      target.id,
    ]);
    console.log(
      `\nLegacy stack ${target.id}: guest built with device canvas ${target.legacyLogical.join("×")}.`,
    );
    const stack = resolveLegacyStack(target.id);
    if (stack.nativeTier) {
      // The stack deploys through an ios-native tier (same takeover host, stack canvas).
      const tierArg = `--tier=${stack.nativeTier}`;
      const tool = join(PROJECT_ROOT, "tools/ios-native.ts");
      // Always rebuild: a receipt from a pocket.json-canvas build of the same tier would deploy.
      mustRun(process.execPath, [tool, tierArg, "deploy", "--build"]);
      mustRun(process.execPath, [tool, tierArg, "launch"]);
      return;
    }
    console.log("Native .app install uses the PocketJS framework host:");
    mustRun(process.execPath, [join(PROJECT_ROOT, "tools/ios-legacy.ts"), "native", target.id]);
    return;
  }

  if (target.kind === "ios-app") {
    const udid = device.udid;
    const runArgs = ["tools/ios-app.ts", "run", "--physical", `--udid=${udid}`];
    if (!forceBuild) {
      runArgs.push("--no-build");
    }
    mustRun(process.execPath, runArgs);
    return;
  }

  const tier = resolveIosNativeTier(target.id);
  const tierArg = `--tier=${tier.id}`;
  if (forceBuild) {
    mustRun(process.execPath, [join(PROJECT_ROOT, "tools/ios-native.ts"), tierArg, "build"]);
  }
  mustRun(process.execPath, [
    join(PROJECT_ROOT, "tools/ios-native.ts"),
    tierArg,
    "deploy",
    ...(forceBuild ? ["--build"] : []),
  ]);
  mustRun(process.execPath, [join(PROJECT_ROOT, "tools/ios-native.ts"), tierArg, "launch"]);
}

const [command, ...rest] = Bun.argv.slice(2);

switch (command) {
  case "detect":
    await detect(flagValue(rest, "--udid"));
    break;
  case "ship":
    await ship(rest);
    break;
  default:
    console.log(`Usage: bun tools/ios-device.ts <command>

Commands:
  detect [--udid=]     Print USB identity + resolved build target (JSON)
  ship [--udid=] [--build]   Auto build (if needed), deploy, launch

Requires: idevice_id, ideviceinfo, iproxy, ssh, scp (jailbroken USB)
`);
    if (command && command !== "help") process.exit(1);
}
