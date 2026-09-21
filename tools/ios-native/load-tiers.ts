import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PROJECT_ROOT } from "../paths.ts";
import { IOS_TAKEOVER_TIERS } from "../ios/paths.ts";

export interface IosNativeTier {
  readonly id: string;
  readonly targetId: string;
  readonly hostAbi: number;
  readonly deploymentTarget: string;
  readonly clangTarget: string;
  readonly rustTargetTriple: string;
  readonly rustTargetSpec?: string;
  readonly requiresRustNightly: boolean;
  readonly defaultRasterDensity: number;
  readonly description: string;
}

interface TierManifest {
  readonly id: string;
  readonly targetId: string;
  readonly hostAbi: number;
  readonly deploymentTarget: string;
  readonly clangTarget: string;
  readonly rustTargetTriple: string;
  readonly rustTargetSpec?: string;
  readonly requiresRustNightly?: boolean;
  readonly defaultRasterDensity: number;
  readonly description: string;
}

const TIERS_DIR = IOS_TAKEOVER_TIERS;

function resolveRustSpec(path: string | undefined): string | undefined {
  if (!path) return undefined;
  const absolute = join(PROJECT_ROOT, path);
  if (!existsSync(absolute)) {
    throw new Error(`ios-native tier: missing rust target spec at ${path}`);
  }
  return absolute;
}

function loadTierManifest(fileName: string): IosNativeTier {
  const raw = JSON.parse(readFileSync(join(TIERS_DIR, fileName), "utf8")) as TierManifest;
  if (!raw.id || !raw.targetId || !raw.rustTargetTriple) {
    throw new Error(`ios-native tier: invalid manifest ${fileName}`);
  }
  return {
    id: raw.id,
    targetId: raw.targetId,
    hostAbi: raw.hostAbi,
    deploymentTarget: raw.deploymentTarget,
    clangTarget: raw.clangTarget,
    rustTargetTriple: raw.rustTargetTriple,
    rustTargetSpec: resolveRustSpec(raw.rustTargetSpec),
    requiresRustNightly: raw.requiresRustNightly === true,
    defaultRasterDensity: raw.defaultRasterDensity,
    description: raw.description,
  };
}

let cached: Record<string, IosNativeTier> | undefined;

export function iosNativeTiers(): Record<string, IosNativeTier> {
  if (cached) return cached;
  const tiers: Record<string, IosNativeTier> = {};
  for (const name of readdirSync(TIERS_DIR).sort()) {
    if (!name.endsWith(".tier.json")) continue;
    const tier = loadTierManifest(name);
    tiers[tier.id] = tier;
  }
  if (Object.keys(tiers).length === 0) {
    throw new Error(`ios-native: no *.tier.json files in ${TIERS_DIR}`);
  }
  cached = tiers;
  return tiers;
}
