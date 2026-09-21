import { cpSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { verifyPocketGuestAssets } from "./sync-native-app.ts";

/** Same layout as `@pocketjs/framework` `tools/ios.ts` `stageAssets`. */
export function stageGuestIntoShell(options: {
  shellDir: string;
  appOutput: string;
  bundlePath: string;
  pakPath: string;
  planPath: string;
  tickHz: number;
  externalGuest: boolean;
}): void {
  const assets = join(options.shellDir, "src/assets/pocket");
  mkdirSync(assets, { recursive: true });
  cpSync(options.bundlePath, join(assets, `${options.appOutput}.pocketjs`));
  cpSync(options.pakPath, join(assets, `${options.appOutput}.pak`));
  cpSync(options.planPath, join(assets, `${options.appOutput}.plan.json`));
  writeFileSync(
    join(assets, "current.json"),
    JSON.stringify(
      {
        app: options.appOutput,
        externalGuest: options.externalGuest,
        tickHz: options.tickHz,
      },
      null,
      2,
    ) + "\n",
  );
  verifyPocketGuestAssets(assets, options.appOutput);
}
