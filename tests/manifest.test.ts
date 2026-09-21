import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { validateAndResolveBuildPlan } from "@pocketjs/framework/manifest";

const manifest = await Bun.file(join(import.meta.dir, "../pocket.json")).json();

describe("pocket.json contracts", () => {
  test("web-app target resolves", () => {
    const result = validateAndResolveBuildPlan(manifest, { target: "web-app" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan.app.output).toBe("pocket-home-main");
      expect(result.plan.app.framework).toBe("vue-vapor");
    }
  });
});
