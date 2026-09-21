// Pocket Home — all iOS / iPadOS run targets (web, modern app, jailbreak takeover, legacy).
//
//   bun tools/ios-harness.ts list
//   bun tools/ios-harness.ts doctor [--target=<id>]
//   bun tools/ios-harness.ts build-all
//   bun tools/ios-harness.ts run [target] [extra args…]
import { PROJECT_ROOT } from "./paths.ts";
import { legacyStacks } from "./ios-legacy/stacks.ts";
import { listIosNativeTierIds } from "./ios-native/tiers.ts";
import { listUsbDeviceUdids, usbProbeToolsInstalled } from "./ios/device-probe.ts";

export type HarnessTargetKind = "web" | "ios" | "takeover" | "legacy";

export interface HarnessTarget {
  readonly id: string;
  readonly kind: HarnessTargetKind;
  readonly label: string;
  readonly runHint: string;
}

function legacyHarnessTargets(): HarnessTarget[] {
  return legacyStacks().map((stack) => ({
    id: stack.id,
    kind: "legacy" as const,
    label: stack.label,
    runHint: stack.unsupportedReason
      ? stack.unsupportedReason
      : stack.frameworkNativeTool
        ? `bun tools/ios-legacy.ts build-guest ${stack.id} && bun tools/ios-legacy.ts native ${stack.id}`
        : `bun tools/ios-legacy.ts build-guest ${stack.id}`,
  }));
}

export function harnessTargets(): HarnessTarget[] {
  const targets: HarnessTarget[] = [
    {
      id: "web",
      kind: "web",
      label: "Browser (any desktop / tablet browser)",
      runHint: "bun run dev",
    },
    {
      id: "ios",
      kind: "ios",
      label: "Modern iOS / iPadOS (iOS 16+) — Simulator or USB device",
      runHint: "bun run ios -- run  (USB if connected, else Simulator)",
    },
    {
      id: "takeover",
      kind: "takeover",
      label: "Jailbreak UIKit takeover (older hardware / pre–iOS 16)",
      runHint: "bun run ios -- run takeover  (USB) or bun run ios -- run takeover:arm64-ios12",
    },
  ];
  for (const tierId of listIosNativeTierIds()) {
    targets.push({
      id: `takeover:${tierId}`,
      kind: "takeover",
      label: `Jailbreak takeover — tier ${tierId}`,
      runHint: `bun run ios -- run takeover:${tierId}`,
    });
  }
  return [...targets, ...legacyHarnessTargets()];
}

function findTarget(id: string): HarnessTarget | undefined {
  return harnessTargets().find((t) => t.id === id);
}

function parseArgs(argv: string[]): { command: string; target?: string; rest: string[] } {
  let target: string | undefined;
  const rest: string[] = [];
  for (const arg of argv) {
    if (arg.startsWith("--target=")) target = arg.slice("--target=".length);
    else rest.push(arg);
  }
  const command = rest[0] ?? "help";
  return { command, target, rest: rest.slice(1) };
}

function mustRun(executable: string, args: readonly string[]): void {
  const result = Bun.spawnSync({
    cmd: [executable, ...args],
    cwd: PROJECT_ROOT,
    stdout: "inherit",
    stderr: "inherit",
  });
  if (result.exitCode !== 0) {
    process.exit(result.exitCode ?? 1);
  }
}

function list(): void {
  console.log("Pocket Home run targets (commit hosts/ — see hosts/README.md)\n");
  for (const target of harnessTargets()) {
    console.log(`  ${target.id}`);
    console.log(`    ${target.label}`);
    console.log(`    → ${target.runHint}\n`);
  }
  console.log("Jailbreak tiers: hosts/ios/takeover/tiers/*.tier.json");
  console.log("Legacy stacks: hosts/ios/legacy/stacks/*.stack.json");
}

async function doctor(targetId?: string): Promise<void> {
  if (!targetId || targetId === "web") {
    console.log("=== web ===\n");
    mustRun(process.execPath, ["tools/check.ts"]);
  }
  if (!targetId || targetId === "ios" || targetId === "simulator") {
    console.log("\n=== modern iOS app ===\n");
    mustRun(process.execPath, ["tools/ios-app.ts", "doctor"]);
  }
  if (
    !targetId ||
    targetId.startsWith("takeover:") ||
    targetId === "takeover" ||
    targetId === "device"
  ) {
    const tiers = targetId?.startsWith("takeover:")
      ? [targetId.slice("takeover:".length)]
      : targetId?.startsWith("device:")
        ? [targetId.slice("device:".length)]
        : listIosNativeTierIds();
    for (const tierId of tiers) {
      console.log(`\n=== jailbreak tier ${tierId} ===\n`);
      mustRun(process.execPath, ["tools/ios-native.ts", `--tier=${tierId}`, "doctor"]);
    }
  }
  if (targetId === "legacy" || legacyStacks().some((s) => s.id === targetId)) {
    console.log("\n=== legacy stacks ===\n");
    for (const stack of legacyStacks()) {
      console.log(
        `${stack.id}: ${stack.unsupportedReason ?? `bun tools/ios-legacy.ts build-guest ${stack.id}`}`,
      );
    }
  }
}

function buildAll(): void {
  console.log("=== web guest ===\n");
  mustRun(process.execPath, ["tools/build.ts"]);
  console.log("\n=== modern iOS app guest ===\n");
  mustRun(process.execPath, ["tools/ios-app.ts", "build"]);
  console.log("\n=== all jailbreak device tiers ===\n");
  mustRun(process.execPath, ["tools/ios-native.ts", "build-all"]);
  console.log("\n=== all legacy stack guests (iOS 6, …) ===\n");
  mustRun(process.execPath, ["tools/ios-legacy.ts", "build-guest-all"]);
}

function runSmart(extra: string[]): void {
  const udids = listUsbDeviceUdids();
  if (udids.length > 0) {
    console.log("ios: USB device detected — routing via tools/ios-device.ts ship\n");
    mustRun(process.execPath, ["tools/ios-device.ts", "ship", ...extra]);
    return;
  }
  console.log("ios: no USB device — launching Simulator (same modern app)\n");
  mustRun(process.execPath, ["tools/ios-app.ts", "run", ...extra]);
}

function runTakeover(tierId: string | undefined, extra: string[]): void {
  if (tierId) {
    const sub = extra[0];
    if (sub === "build" || sub === "deploy" || sub === "launch") {
      mustRun(process.execPath, [
        "tools/ios-native.ts",
        `--tier=${tierId}`,
        sub,
        ...extra.slice(1),
      ]);
    } else {
      mustRun(process.execPath, ["tools/ios-native.ts", `--tier=${tierId}`, "build", ...extra]);
      mustRun(process.execPath, ["tools/ios-native.ts", `--tier=${tierId}`, "deploy", ...extra]);
      mustRun(process.execPath, ["tools/ios-native.ts", `--tier=${tierId}`, "launch", ...extra]);
    }
    return;
  }
  mustRun(process.execPath, ["tools/ios-device.ts", "ship", ...extra]);
}

function run(targetId: string, extra: string[]): void {
  if (targetId === "simulator") {
    console.warn('ios: target "simulator" renamed to "ios" (same modern app)\n');
    targetId = "ios";
  }
  if (targetId === "device") {
    console.warn('ios: target "device" renamed — use "ios" (modern) or "takeover" (jailbreak)\n');
    runSmart(extra);
    return;
  }

  const target = findTarget(targetId);
  if (!target) {
    if (targetId.startsWith("device:")) {
      runTakeover(targetId.slice("device:".length), extra);
      return;
    }
    console.error(`unknown target "${targetId}" — run: bun run ios -- list`);
    process.exit(1);
  }
  switch (target.kind) {
    case "web":
      mustRun(process.execPath, ["tools/dev.ts", ...extra]);
      break;
    case "ios":
      if (targetId === "ios" && (!extra[0] || extra[0].startsWith("--"))) {
        runSmart(extra);
      } else {
        mustRun(process.execPath, ["tools/ios-app.ts", "run", ...extra]);
      }
      break;
    case "takeover": {
      const tierId = target.id === "takeover" ? undefined : target.id.slice("takeover:".length);
      runTakeover(tierId, extra);
      break;
    }
    case "legacy": {
      const stack = legacyStacks().find((s) => s.id === target.id);
      if (stack?.unsupportedReason) {
        console.log(stack.unsupportedReason);
        break;
      }
      const sub = extra[0];
      if (sub === "native") {
        mustRun(process.execPath, ["tools/ios-legacy.ts", "native", target.id, ...extra.slice(1)]);
      } else if (sub === "guest") {
        mustRun(process.execPath, [
          "tools/ios-legacy.ts",
          "build-guest",
          target.id,
          ...extra.slice(1),
        ]);
      } else {
        mustRun(process.execPath, ["tools/ios-legacy.ts", "build-guest", target.id, ...extra]);
        console.log(target.runHint);
      }
      break;
    }
    default:
      break;
  }
}

function help(): void {
  console.log(`Usage: bun tools/ios-harness.ts <command>

Commands:
  list                 all targets + run commands
  detect               USB device identity + resolved route (modern / takeover / legacy)
  doctor [--target=]   web check, modern ios-app, jailbreak tier(s), legacy
  build-all            web + modern ios guest + every takeover tier + legacy guests
  run [target]         default: USB → auto route, else Simulator (modern app)

Targets:
  web | ios | takeover | takeover:<tier> | legacy stack ids

Examples:
  bun run ios -- run
  bun run ios -- run ios -- --simulator="iPad Pro"
  bun run ios -- run takeover:arm64-ios12
  bun run ios -- detect
`);
}

function detect(): void {
  if (!usbProbeToolsInstalled()) {
    console.log(
      "ios: USB tools not installed — install libimobiledevice (macOS: `brew install libimobiledevice`)",
    );
    console.log("    use `bun run ios -- run` for Simulator without a physical device");
    process.exit(1);
  }
  const udids = listUsbDeviceUdids();
  if (udids.length === 0) {
    console.log("ios: no USB device — use `bun run ios -- run` for Simulator");
    process.exit(1);
  }
  mustRun(process.execPath, ["tools/ios-device.ts", "detect"]);
}

const { command, target, rest } = parseArgs(Bun.argv.slice(2));

switch (command) {
  case "list":
    list();
    break;
  case "doctor":
    await doctor(target);
    break;
  case "build-all":
    buildAll();
    break;
  case "run":
    if (!rest[0] || rest[0].startsWith("--")) {
      runSmart(rest);
      break;
    }
    run(rest[0], rest.slice(1));
    break;
  case "detect":
    detect();
    break;
  case "help":
  default:
    help();
    if (command !== "help") process.exit(1);
}
