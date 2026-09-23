import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { verifyPocketGuestAssets } from "./sync-native-app.ts";

/** One built guest: glyph/raster density x tick rate (both are baked into the bundle). */
export interface GuestVariantArtifacts {
  readonly density: number;
  readonly tickHz: number;
  readonly bundlePath: string;
  readonly pakPath: string;
  readonly planPath: string;
}

/** `current.json` variant entry; names are extensionless paths under assets/pocket/. */
export interface StagedVariant {
  readonly density: number;
  readonly tickHz: number;
  readonly bundle: string;
  readonly pak: string;
}

export function variantBundleName(appOutput: string, density: number, tickHz: number): string {
  return `${appOutput}.d${density}.h${tickHz}`;
}

export function variantPakName(appOutput: string, density: number): string {
  return `${appOutput}.d${density}`;
}

/**
 * Stage every guest variant into the shell (`src/assets/pocket/`). The pak depends only on the
 * density, so it is staged once per density; the bundle once per density x tick rate. The shell
 * (hosts/ios/app/src/ios-pocket-host.ts) picks the variant matching the device at mount time.
 */
export function stageGuestIntoShell(options: {
  shellDir: string;
  appOutput: string;
  variants: readonly GuestVariantArtifacts[];
  externalGuest: boolean;
}): void {
  const assets = join(options.shellDir, "src/assets/pocket");
  mkdirSync(assets, { recursive: true });
  // Drop previously staged guests (single-variant layouts included).
  for (const name of readdirSync(assets)) {
    if (/\.(pocketjs|pak)$|\.plan\.json$/.test(name)) rmSync(join(assets, name));
  }
  const staged: StagedVariant[] = [];
  for (const v of options.variants) {
    const bundle = variantBundleName(options.appOutput, v.density, v.tickHz);
    const pak = variantPakName(options.appOutput, v.density);
    cpSync(v.bundlePath, join(assets, `${bundle}.pocketjs`));
    if (!existsSync(join(assets, `${pak}.pak`))) {
      cpSync(v.pakPath, join(assets, `${pak}.pak`));
      cpSync(v.planPath, join(assets, `${pak}.plan.json`));
    }
    staged.push({ density: v.density, tickHz: v.tickHz, bundle, pak });
  }
  writeFileSync(
    join(assets, "current.json"),
    JSON.stringify(
      { app: options.appOutput, externalGuest: options.externalGuest, variants: staged },
      null,
      2,
    ) + "\n",
  );
  verifyPocketGuestAssets(assets);
}
