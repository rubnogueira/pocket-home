import { PROJECT_ROOT } from "../paths.ts";

export interface UsbDeviceIdentity {
  readonly udid: string;
  readonly productType: string;
  readonly hardwareModel: string;
  readonly productVersion: string;
  readonly buildVersion: string;
  readonly cpuArchitecture: string;
  readonly deviceName: string;
}

const USB_PROBE_INSTALL_HINT = "install libimobiledevice (macOS: `brew install libimobiledevice`)";

export function usbProbeToolsInstalled(): boolean {
  return Bun.which("idevice_id") !== null && Bun.which("ideviceinfo") !== null;
}

function run(executable: string, args: readonly string[]): { exitCode: number; stdout: string } {
  const resolved = Bun.which(executable);
  if (!resolved) return { exitCode: 127, stdout: "" };
  const result = Bun.spawnSync({
    cmd: [resolved, ...args],
    cwd: PROJECT_ROOT,
    stdout: "pipe",
    stderr: "pipe",
  });
  return { exitCode: result.exitCode, stdout: result.stdout.toString().trim() };
}

export function listUsbDeviceUdids(): string[] {
  const result = run("idevice_id", ["-l"]);
  if (result.exitCode !== 0) return [];
  return result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function deviceInfo(udid: string, key: string): string {
  const result = run("ideviceinfo", ["-u", udid, "-k", key]);
  if (result.exitCode !== 0) return "";
  return result.stdout.trim();
}

export function probeUsbDevice(udid?: string): UsbDeviceIdentity {
  if (!usbProbeToolsInstalled()) {
    throw new Error(`ios-device: USB tools missing — ${USB_PROBE_INSTALL_HINT}`);
  }
  const udids = listUsbDeviceUdids();
  if (udids.length === 0) {
    throw new Error(
      "ios-device: no USB device — connect a jailbroken iPhone/iPad/iPod and trust the host",
    );
  }
  const selected =
    udid ?? process.env.POCKET_IOS_UDID ?? (udids.length === 1 ? udids[0] : undefined);
  if (!selected) {
    throw new Error(
      `ios-device: ${udids.length} devices connected — pass --udid= or set POCKET_IOS_UDID\n` +
        udids.map((id) => `  ${id}`).join("\n"),
    );
  }
  return {
    udid: selected,
    productType: deviceInfo(selected, "ProductType"),
    hardwareModel: deviceInfo(selected, "HardwareModel"),
    productVersion: deviceInfo(selected, "ProductVersion"),
    buildVersion: deviceInfo(selected, "BuildVersion"),
    cpuArchitecture: deviceInfo(selected, "CPUArchitecture"),
    deviceName: deviceInfo(selected, "DeviceName"),
  };
}
