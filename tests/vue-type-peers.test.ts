import { describe, expect, test } from "bun:test";
import { assertVueTypePeersHoisted } from "../tools/vue-type-peers.ts";

describe("vue type peers", () => {
  test("hoist @vue/* packages required by vue type re-exports", () => {
    expect(() => assertVueTypePeersHoisted()).not.toThrow();
  });
});
