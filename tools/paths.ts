import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Pocket Home repository root (parent of `tools/`). */
export const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Application source (Lovelace renderer, entry, chrome icons). */
export const APP_DIR = join(PROJECT_ROOT, "app");

function looksLikeFramework(dir: string): boolean {
  return existsSync(join(dir, "tools/build.ts")) && existsSync(join(dir, "framework/src/index.ts"));
}

/** PocketJS checkout that supplies `tools/` and `framework/` (npm package or monorepo parent). */
export function frameworkRoot(): string {
  const env = process.env.POCKETJS_FRAMEWORK_ROOT;
  if (env) return resolve(env);
  const candidates = [
    // Prefer the in-tree PocketJS checkout when this app is nested in the monorepo.
    resolve(PROJECT_ROOT, ".."),
    resolve(PROJECT_ROOT, "node_modules/@pocketjs/framework"),
  ];
  for (const dir of candidates) {
    if (looksLikeFramework(dir)) return dir;
  }
  throw new Error(
    "Pocket Home: install @pocketjs/framework (`bun install`), set POCKETJS_FRAMEWORK_ROOT, " +
      "or place this repo inside a PocketJS checkout",
  );
}
