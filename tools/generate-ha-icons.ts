// Bake Home Assistant / MDI icons into PNG assets for Pocket Home.
//
//   bun tools/generate-ha-icons.ts [--density=N]

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import * as mdi from "@mdi/js";
import { APP_DIR, PROJECT_ROOT } from "./paths.ts";

/** Relative to `app/main.tsx` (PocketJS resolves images from the entry directory). */
const ICON_ASSET_PREFIX = "./icons/generated/mdi";

const MDI_RE = /mdi:([a-z0-9-]+)/gi;

const DEVICE_CLASS_ICONS: Record<string, string> = {
  temperature: "thermometer",
  humidity: "water-percent",
  battery: "battery",
  power: "flash",
  energy: "lightning-bolt",
  plug: "power-plug",
  motion: "motion-sensor",
  door: "door",
  illuminance: "brightness-5",
  precipitation: "weather-pouring",
  voltage: "flash",
  current: "current-ac",
  gas: "meter-gas",
  carbon_monoxide: "molecule-co",
  co2: "molecule-co2",
};

const UI_ICONS = [
  "menu",
  "close",
  "pencil",
  "cog",
  "help-circle",
  "view-dashboard",
  "map",
  "lightning-bolt",
  "white-balance-sunny",
];

export interface GenerateHaIconsOptions {
  appDir: string;
  rasterDensity: number;
}

function kebabToMdiExport(kebab: string): string {
  const parts = kebab.split("-").filter(Boolean);
  return "mdi" + parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("");
}

function lookupPathData(kebab: string): string | undefined {
  const key = kebabToMdiExport(kebab) as keyof typeof mdi;
  const v = mdi[key];
  return typeof v === "string" ? v : undefined;
}

function walkTsFiles(dir: string, out: string[]): void {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, name.name);
    if (name.isDirectory()) {
      if (name.name === "generated" || name.name === "node_modules" || name.name === "tests")
        continue;
      walkTsFiles(p, out);
    } else if (/\.tsx?$/i.test(name.name)) out.push(p);
  }
}

function collectMdiFromSources(appDir: string): Set<string> {
  const names = new Set<string>();
  const files: string[] = [];
  walkTsFiles(appDir, files);
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    let m: RegExpExecArray | null;
    MDI_RE.lastIndex = 0;
    while ((m = MDI_RE.exec(src))) names.add(m[1]);
  }
  return names;
}

function loadDomainIcons(projectRoot: string): string[] {
  const entityTypes = join(projectRoot, "app/types/entity.ts");
  if (!existsSync(entityTypes)) return [];
  const src = readFileSync(entityTypes, "utf8");
  const block = src.match(/DOMAIN_ICONS[^=]*=\s*\{([^}]+)\}/s);
  if (!block) return [];
  const names: string[] = [];
  const valRe = /:\s*"([a-z0-9-]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = valRe.exec(block[1]))) names.push(m[1]);
  return names;
}

function loadManifest(projectRoot: string): string[] {
  const path = join(projectRoot, "app/icons/manifest.json");
  if (!existsSync(path)) return [];
  const data = JSON.parse(readFileSync(path, "utf8")) as { icons?: string[] };
  return data.icons ?? [];
}

export function collectHaIconNames(appDir: string): string[] {
  const set = new Set<string>();
  for (const n of loadManifest(appDir)) set.add(n);
  for (const n of loadDomainIcons(appDir)) set.add(n);
  for (const n of Object.values(DEVICE_CLASS_ICONS)) set.add(n);
  for (const n of UI_ICONS) set.add(n);
  for (const n of collectMdiFromSources(appDir)) set.add(n);
  set.add("help-circle");
  return [...set].sort();
}

async function rasterizeMdi(pathData: string, pixelSize: number): Promise<Buffer> {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24">` +
    `<path fill="#ffffff" d="${pathData}"/></svg>`;
  const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  const img = await loadImage(dataUrl);
  const canvas = createCanvas(pixelSize, pixelSize);
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, pixelSize, pixelSize);
  ctx.drawImage(img, 0, 0, pixelSize, pixelSize);
  return canvas.toBuffer("image/png");
}

export async function generateHaIcons(opts: GenerateHaIconsOptions): Promise<void> {
  const { appDir: projectRoot, rasterDensity } = opts;
  const names = collectHaIconNames(projectRoot);
  const outDir = join(APP_DIR, "icons/generated/mdi");
  mkdirSync(outDir, { recursive: true });

  const registry: Record<string, string> = {};
  let baked = 0;
  let missing = 0;

  const logicalCell = 32;
  // Pak images must be a power of two (<= 512): round the density-scaled cell up
  // (3x -> 128 px). Icons are drawn at an explicit style size, so extra texels only
  // mean a sharper downsample, never a different layout.
  const pixelSize = Math.min(512, 2 ** Math.ceil(Math.log2(logicalCell * rasterDensity)));

  for (const name of names) {
    const pathData = lookupPathData(name);
    const relAsset = `${ICON_ASSET_PREFIX}/${name}.png`;
    const absAsset = join(outDir, `${name}.png`);
    if (!pathData) {
      missing++;
      console.warn(`  ha-icons: missing @mdi/js path for "${name}"`);
      continue;
    }
    const png = await rasterizeMdi(pathData, pixelSize);
    writeFileSync(absAsset, png);
    registry[name] = relAsset;
    baked++;
  }

  const fallback =
    registry["help-circle"] ?? registry[names[0]] ?? `${ICON_ASSET_PREFIX}/help-circle.png`;
  const genDir = join(APP_DIR, "icons/generated");
  mkdirSync(genDir, { recursive: true });

  const registryPath = join(genDir, "registry.ts");
  const lines = [
    "// AUTO-GENERATED by tools/generate-ha-icons.ts — do not edit.",
    `// ${baked} icon(s) @ ${pixelSize}px (${rasterDensity}x).`,
    "",
    "export const HA_ICON_ASSETS: Record<string, string> = {",
  ];
  for (const name of Object.keys(registry).sort()) {
    lines.push(`  "${name}": "${registry[name]}",`);
  }
  lines.push("};");
  lines.push("");
  lines.push(`export const HA_ICON_FALLBACK = "${fallback}";`);
  lines.push("");
  lines.push("export const HA_ICON_BAKE_PATHS: readonly string[] = [");
  for (const name of Object.keys(registry).sort()) {
    lines.push(`  "${registry[name]}",`);
  }
  lines.push(`  "${fallback}",`);
  lines.push("];");
  lines.push("");

  writeFileSync(registryPath, lines.join("\n"));
  console.log(
    `  ha-icons: ${baked} PNG(s) → app/icons/generated/mdi` +
      (missing ? ` (${missing} unknown)` : ""),
  );
}

if (import.meta.main) {
  let density = 2;
  for (const a of Bun.argv.slice(2)) {
    if (a.startsWith("--density=")) density = Number(a.slice("--density=".length));
  }
  await generateHaIcons({ appDir: PROJECT_ROOT, rasterDensity: density });
}
