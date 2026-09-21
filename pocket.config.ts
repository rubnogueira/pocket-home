import { definePocketConfig } from "@pocketjs/framework/config";

/** Manifest builds read `framework` from pocket.json only. Web builds get `--framework` via tools/build.ts. */
export default definePocketConfig({});
