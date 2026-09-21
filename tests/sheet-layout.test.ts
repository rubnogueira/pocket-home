/**
 * Run: bun test tests/sheet-layout.test.ts
 */

import { describe, expect, test } from "bun:test";
import { SHEET_FULL_WIDTH_BREAKPOINT, sheetPanelWidth } from "../app/ui/sheet-layout.ts";
import { haCardBodyTextMaxWidth } from "../app/ui/wrap-text.ts";

describe("sheetPanelWidth", () => {
  test("uses full viewport below breakpoint", () => {
    expect(sheetPanelWidth(320, 340, SHEET_FULL_WIDTH_BREAKPOINT)).toBe(320);
    expect(sheetPanelWidth(499, 340, SHEET_FULL_WIDTH_BREAKPOINT)).toBe(499);
  });

  test("uses preferred width on large screens", () => {
    expect(sheetPanelWidth(800, 340, SHEET_FULL_WIDTH_BREAKPOINT)).toBe(340);
    expect(sheetPanelWidth(1920, 340, SHEET_FULL_WIDTH_BREAKPOINT)).toBe(340);
  });

  test("never exceeds viewport", () => {
    expect(sheetPanelWidth(300, 340, SHEET_FULL_WIDTH_BREAKPOINT)).toBe(300);
  });
});

describe("haCardBodyTextMaxWidth", () => {
  test("reserves horizontal padding", () => {
    expect(haCardBodyTextMaxWidth(320)).toBe(272);
    expect(haCardBodyTextMaxWidth(40)).toBe(80);
  });
});
