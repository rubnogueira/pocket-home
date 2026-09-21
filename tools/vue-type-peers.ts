import { createRequire } from "node:module";
import { join } from "node:path";
import { PROJECT_ROOT } from "./paths.ts";

/** Packages re-exported by `vue` types — must resolve from the app root under Bun. */
export const VUE_TYPE_PEER_PACKAGES = ["@vue/runtime-dom", "@vue/runtime-vapor"] as const;

export function assertVueTypePeersHoisted(): void {
  const require = createRequire(join(PROJECT_ROOT, "package.json"));
  for (const pkg of VUE_TYPE_PEER_PACKAGES) {
    try {
      require.resolve(`${pkg}/package.json`);
    } catch {
      throw new Error(
        `Pocket Home: ${pkg} must be a devDependency (catalog version matching vue) so imports from "vue" typecheck. Run bun install at the repo root.`,
      );
    }
  }
}
