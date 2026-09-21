import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export interface AppEntryCheckOptions {
  entry: string;
  tsconfigPath?: string;
  declarationFiles?: readonly string[];
}

export interface AppEntryCheckResult {
  ok: boolean;
  checkedFiles: string[];
  diagnostics: string[];
}

function ephemeralTsconfig(
  entry: string,
  tsconfigPath: string | undefined,
  declarationFiles: readonly string[],
): string {
  const config: Record<string, unknown> = {
    ...(tsconfigPath ? { extends: tsconfigPath } : {}),
    compilerOptions: {
      target: "ESNext",
      module: "ESNext",
      moduleResolution: "bundler",
      strict: true,
      noEmit: true,
      jsx: "preserve",
      allowImportingTsExtensions: true,
      lib: ["ESNext", "DOM"],
      skipLibCheck: true,
      incremental: false,
      composite: false,
      types: [],
    },
    files: [entry, ...declarationFiles],
    include: [],
    exclude: [],
  };
  return JSON.stringify(config, null, 2) + "\n";
}

/** Typecheck the app entry graph via `tsc` (TypeScript 7–compatible). */
export function checkAppEntry(options: AppEntryCheckOptions): AppEntryCheckResult {
  const entry = resolve(options.entry);
  if (!existsSync(entry)) {
    throw new Error(`Pocket Home app check: entry not found: ${entry}`);
  }
  const inheritedConfig = options.tsconfigPath ? resolve(options.tsconfigPath) : undefined;
  if (inheritedConfig && !existsSync(inheritedConfig)) {
    throw new Error(`Pocket Home app check: tsconfig not found: ${inheritedConfig}`);
  }

  const declarationFiles = (options.declarationFiles ?? []).map((file) => resolve(file));
  for (const file of declarationFiles) {
    if (!existsSync(file)) {
      throw new Error(`Pocket Home app check: declaration file not found: ${file}`);
    }
  }

  const temporaryParent = inheritedConfig ? dirname(inheritedConfig) : dirname(entry);
  const directory = mkdtempSync(resolve(temporaryParent, ".pocketjs-app-check-"));
  const generatedConfigPath = resolve(directory, "tsconfig.json");
  writeFileSync(generatedConfigPath, ephemeralTsconfig(entry, inheritedConfig, declarationFiles));

  try {
    const tsc = Bun.spawnSync(
      [process.execPath, "x", "tsc", "-p", generatedConfigPath, "--pretty", "false"],
      { cwd: dirname(generatedConfigPath), stdout: "pipe", stderr: "pipe" },
    );
    const output = `${tsc.stdout}\n${tsc.stderr}`.trim();
    const diagnostics = output ? output.split("\n").filter(Boolean) : [];
    const checkedFiles = [entry, ...declarationFiles].sort();
    return { ok: tsc.exitCode === 0, checkedFiles, diagnostics };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
