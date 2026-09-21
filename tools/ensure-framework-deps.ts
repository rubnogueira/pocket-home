// @pocketjs/framework's compiler resolves vue/solid-js from
// `node_modules/@pocketjs/framework/node_modules/*`. Link them from the
// Bun workspace install paths (app root for vue, compiler-host for solid-js).
import { createRequire } from "node:module";
import { lstatSync, mkdirSync, realpathSync, symlinkSync, unlinkSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { frameworkRoot, PROJECT_ROOT } from "./paths.ts";

function resolvePackageRoot(resolverEntry: string, name: string): string {
  const require = createRequire(resolverEntry);
  return dirname(require.resolve(`${name}/package.json`));
}

const LINKS: { pkg: string; resolverEntry: string }[] = [
  { pkg: "vue", resolverEntry: join(PROJECT_ROOT, "package.json") },
  {
    pkg: "solid-js",
    resolverEntry: join(PROJECT_ROOT, "tools/compiler-host/package.json"),
  },
];

export function ensureFrameworkDeps(): void {
  const fw = frameworkRoot();
  const nestedRoot = join(fw, "node_modules");
  mkdirSync(nestedRoot, { recursive: true });

  for (const { pkg, resolverEntry } of LINKS) {
    const source = resolvePackageRoot(resolverEntry, pkg);
    const link = join(nestedRoot, pkg);
    const sourceReal = realpathSync(source);
    const linkParentReal = realpathSync(nestedRoot);
    const rel = relative(linkParentReal, sourceReal);
    try {
      const stat = lstatSync(link);
      if (!stat.isSymbolicLink()) {
        throw new Error(`Pocket Home: expected symlink at ${link}`);
      }
      try {
        if (realpathSync(link) === sourceReal) continue;
      } catch {
        // Broken symlink — recreate below.
      }
      unlinkSync(link);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }

    symlinkSync(rel, link);
    const stat = lstatSync(link);
    if (!stat.isSymbolicLink()) {
      throw new Error(`Pocket Home: expected symlink at ${link}`);
    }
  }
}

if (import.meta.main) {
  ensureFrameworkDeps();
}
