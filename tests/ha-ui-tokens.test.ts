/**
 * HA dashboard UI tokens — card shell and press surfaces share corner radius.
 *
 * Run: bun test tests/ha-ui-tokens.test.ts
 */

import { describe, expect, test } from "bun:test";
import {
  HA_CARD_SHELL,
  HA_CARD_PRESS_GAP1,
  HA_CARD_PRESS_GAP2,
  HA_CARD_PRESS_GAP3,
  HA_CARD_PRESS_GAP3_NO_PAD,
  HA_CARD_PRESS_CENTER_GAP1,
  HA_CARD_PRESS_CENTER_GAP2,
} from "../app/ui/tokens.ts";

const PRESS_TOKENS = [
  HA_CARD_PRESS_GAP1,
  HA_CARD_PRESS_GAP2,
  HA_CARD_PRESS_GAP3,
  HA_CARD_PRESS_GAP3_NO_PAD,
  HA_CARD_PRESS_CENTER_GAP1,
  HA_CARD_PRESS_CENTER_GAP2,
];

describe("HA card UI tokens", () => {
  test("card shell uses rounded-xl", () => {
    expect(HA_CARD_SHELL).toContain("rounded-xl");
  });

  test("every full-card press token matches shell corner radius", () => {
    for (const token of PRESS_TOKENS) {
      expect(token).toContain("rounded-xl");
      expect(token).toContain("focus:bg-slate-700");
      expect(token).toContain("active:bg-slate-600");
    }
  });
});
