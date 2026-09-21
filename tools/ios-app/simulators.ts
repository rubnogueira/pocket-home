/**
 * Simulator inventory for the dashboard shell.
 * Based on `@pocketjs/framework/tools/ios.ts` (iPhone-only upstream); adds iPad devices
 * and prefers iPad when auto-picking (Pocket Home default layout target).
 */
import { IOS_APP_MIN_RUNTIME } from "./constants.ts";

export interface IosAppSimulator {
  readonly udid: string;
  readonly name: string;
  readonly state: string;
  readonly runtimeName: string;
  readonly runtimeVersion: number;
}

interface CommandResult {
  readonly exitCode: number;
  readonly stdout: string;
}

async function spawn(command: string, args: readonly string[]): Promise<CommandResult> {
  const child = Bun.spawn({
    cmd: [command, ...args],
    stdout: "pipe",
    stderr: "pipe",
    stdin: "ignore",
  });
  const [exitCode, stdout] = await Promise.all([
    child.exited,
    new Response(child.stdout as ReadableStream).text(),
  ]);
  return { exitCode, stdout };
}

async function admissibleRuntimes(): Promise<Map<string, { name: string; version: number }>> {
  const result = await spawn("xcrun", ["simctl", "list", "-j", "runtimes"]);
  const admitted = new Map<string, { name: string; version: number }>();
  if (result.exitCode !== 0) return admitted;
  const parsed = JSON.parse(result.stdout) as {
    runtimes?: Array<{
      identifier?: string;
      isAvailable?: boolean;
      name?: string;
      platform?: string;
      supportedArchitectures?: string[];
      version?: string;
    }>;
  };
  for (const runtime of parsed.runtimes ?? []) {
    const version = Number.parseFloat(runtime.version ?? "0");
    if (
      runtime.identifier &&
      runtime.isAvailable === true &&
      (runtime.platform === "iOS" || runtime.identifier.includes("SimRuntime.iOS")) &&
      (runtime.supportedArchitectures ?? []).includes("arm64") &&
      version >= IOS_APP_MIN_RUNTIME
    ) {
      admitted.set(runtime.identifier, { name: runtime.name ?? runtime.identifier, version });
    }
  }
  return admitted;
}

export async function admissibleIosAppSimulators(): Promise<IosAppSimulator[]> {
  const runtimes = await admissibleRuntimes();
  const result = await spawn("xcrun", ["simctl", "list", "-j", "devices", "available"]);
  if (result.exitCode !== 0) return [];
  const parsed = JSON.parse(result.stdout) as {
    devices?: Record<
      string,
      Array<{ udid?: string; name?: string; state?: string; deviceTypeIdentifier?: string }>
    >;
  };
  const simulators: IosAppSimulator[] = [];
  for (const [runtimeId, devices] of Object.entries(parsed.devices ?? {})) {
    const runtime = runtimes.get(runtimeId);
    if (!runtime) continue;
    for (const device of devices) {
      if (!device.udid || !device.name) continue;
      const kind = device.deviceTypeIdentifier ?? "";
      if (!kind.includes("iPhone") && !kind.includes("iPad")) continue;
      simulators.push({
        udid: device.udid,
        name: device.name,
        state: device.state ?? "Shutdown",
        runtimeName: runtime.name,
        runtimeVersion: runtime.version,
      });
    }
  }
  return simulators;
}

export async function pickIosAppSimulator(request?: string): Promise<IosAppSimulator> {
  const simulators = await admissibleIosAppSimulators();
  if (simulators.length === 0) {
    throw new Error(
      "ios-app: no arm64 iPhone/iPad simulator with iOS 16+ — install via Xcode > Platforms",
    );
  }
  if (request) {
    const match =
      simulators.find((s) => s.udid === request) ||
      simulators.find((s) => s.name.toLowerCase() === request.toLowerCase());
    if (!match) {
      throw new Error(
        `ios-app: no simulator matches "${request}" — run \`bun tools/ios-app.ts devices\``,
      );
    }
    return match;
  }
  const booted = simulators.find((s) => s.state === "Booted");
  if (booted) return booted;
  const ipads = simulators.filter((s) => s.name.toLowerCase().includes("ipad"));
  const pool = ipads.length > 0 ? ipads : simulators;
  return pool.sort((a, b) => b.runtimeVersion - a.runtimeVersion)[0];
}
