import { describe, expect, test } from "bun:test";
import {
  MAX_LOGICAL_AXIS,
  isMountablePanel,
  pickGuestVariant,
  sameSize,
  surfaceViewport,
} from "../hosts/ios/app/src/ios-viewport.ts";

// Safe-area panels / windows in DIPs as UIKit reports them.
const IPAD_PRO_11 = { width: 834, height: 1210 };
const IPAD_PRO_11_PORTRAIT_PANEL = { width: 834, height: 1166 }; // top 24, bottom 20
const IPAD_PRO_11_LANDSCAPE_PANEL = { width: 1210, height: 790 };
const IPAD_PRO_13 = { width: 1032, height: 1376 };
const IPHONE_17 = { width: 402, height: 874 };

describe("surfaceViewport", () => {
  test("keeps small panels 1:1", () => {
    const vp = surfaceViewport({ width: 800, height: 600 });
    expect(vp.scale).toBe(1);
    expect(vp.logical).toEqual({ width: 800, height: 600 });
  });

  test("never exceeds the touch wire on any axis", () => {
    for (const window of [IPAD_PRO_11, IPAD_PRO_13, { width: 2560, height: 1600 }]) {
      for (const panel of [window, { width: window.height, height: window.width }]) {
        const { logical } = surfaceViewport(panel, window);
        expect(logical.width).toBeLessThanOrEqual(MAX_LOGICAL_AXIS);
        expect(logical.height).toBeLessThanOrEqual(MAX_LOGICAL_AXIS);
      }
    }
  });

  test("every iPad lays out in points (1:1 on device pixels), in both orientations", () => {
    for (const [window, panel] of [
      [IPAD_PRO_11, IPAD_PRO_11_PORTRAIT_PANEL],
      [{ width: IPAD_PRO_11.height, height: IPAD_PRO_11.width }, IPAD_PRO_11_LANDSCAPE_PANEL],
      [IPAD_PRO_13, { width: 1032, height: 1332 }],
      [
        { width: IPAD_PRO_13.height, height: IPAD_PRO_13.width },
        { width: 1376, height: 1004 },
      ],
    ] as const) {
      const vp = surfaceViewport(panel, window);
      expect(vp.scale).toBe(1);
      expect(vp.logical).toEqual(panel);
    }
  });

  test("scales only panels past the wire, one scale for both orientations", () => {
    const window = { width: 2560, height: 1600 };
    const landscape = surfaceViewport(window, window);
    const portrait = surfaceViewport({ width: 1600, height: 2560 }, window);
    expect(landscape.scale).toBeCloseTo(2560 / MAX_LOGICAL_AXIS, 10);
    expect(portrait.scale).toBeCloseTo(landscape.scale, 10);
    expect(landscape.logical.width).toBe(MAX_LOGICAL_AXIS);
  });

  test("iPhone panels fit without scaling", () => {
    const panel = { width: IPHONE_17.width, height: IPHONE_17.height - 62 - 34 };
    const vp = surfaceViewport(panel, IPHONE_17);
    expect(vp.scale).toBe(1);
    expect(vp.logical).toEqual(panel);
  });

  test("floors fractional DIPs", () => {
    expect(surfaceViewport({ width: 700.9, height: 500.2 }).logical).toEqual({
      width: 700,
      height: 500,
    });
  });
});

describe("panel guards", () => {
  test("rejects zero / transient panels", () => {
    expect(isMountablePanel({ width: 0, height: 0 })).toBe(false);
    expect(isMountablePanel({ width: 834, height: 10 })).toBe(false);
    expect(isMountablePanel({ width: Number.NaN, height: 800 })).toBe(false);
    expect(isMountablePanel(IPAD_PRO_11_PORTRAIT_PANEL)).toBe(true);
  });

  test("sameSize", () => {
    expect(sameSize({ width: 1, height: 2 }, { width: 1, height: 2 })).toBe(true);
    expect(sameSize({ width: 1, height: 2 }, { width: 2, height: 1 })).toBe(false);
    expect(sameSize(null, { width: 1, height: 2 })).toBe(false);
  });
});

describe("pickGuestVariant", () => {
  const variants = [2, 3].flatMap((density) =>
    [60, 120].map((tickHz) => ({
      density,
      tickHz,
      bundle: `a.d${density}.h${tickHz}`,
      pak: `a.d${density}`,
    })),
  );

  test("iPad: density equals the screen scale (no stretch)", () => {
    const { scale } = surfaceViewport(IPAD_PRO_11_PORTRAIT_PANEL, IPAD_PRO_11);
    const v = pickGuestVariant(variants, { pixelsPerLogical: 2 * scale, maxFps: 120 });
    expect(v).toMatchObject({ tickHz: 120, density: 2 });
  });

  test("60 Hz 2x iPhone: 60 Hz, 2x", () => {
    expect(pickGuestVariant(variants, { pixelsPerLogical: 2, maxFps: 60 })).toMatchObject({
      tickHz: 60,
      density: 2,
    });
  });

  test("3x iPhone Pro: 120 Hz, 3x; denser screens fall back to the largest density", () => {
    expect(pickGuestVariant(variants, { pixelsPerLogical: 3, maxFps: 120 })).toMatchObject({
      tickHz: 120,
      density: 3,
    });
    expect(pickGuestVariant(variants, { pixelsPerLogical: 4, maxFps: 60 })?.density).toBe(3);
  });

  test("single staged variant (pinned --density/--hz) is always used", () => {
    const only = [variants[0]];
    expect(pickGuestVariant(only, { pixelsPerLogical: 3, maxFps: 120 })).toBe(only[0]);
    expect(pickGuestVariant([], { pixelsPerLogical: 2, maxFps: 60 })).toBeNull();
  });

  test("raster budget: drops the rate before the density", () => {
    const { logical, scale } = surfaceViewport(IPAD_PRO_11_PORTRAIT_PANEL, IPAD_PRO_11);
    const device = { pixelsPerLogical: 2 * scale, logicalArea: logical.width * logical.height };
    // A full 2x repaint of 834x1166 (~6.6 ms) overruns a 120 Hz frame: steady 60 Hz, still 2x.
    expect(pickGuestVariant(variants, { ...device, maxFps: 120 })).toMatchObject({
      tickHz: 60,
      density: 2,
    });
    expect(pickGuestVariant(variants, { ...device, maxFps: 60 })).toMatchObject({
      tickHz: 60,
      density: 2,
    });
    // A smaller window (Stage Manager) fits 120 Hz at 2x.
    expect(
      pickGuestVariant(variants, { pixelsPerLogical: 2, maxFps: 120, logicalArea: 700 * 700 }),
    ).toMatchObject({ tickHz: 120, density: 2 });
  });

  test("raster budget: nothing fits even at 60 Hz -> 60 Hz at the densest that fits", () => {
    expect(
      pickGuestVariant(variants, { pixelsPerLogical: 3, maxFps: 120, logicalArea: 1400 * 1000 }),
    ).toMatchObject({ tickHz: 60, density: 2 });
  });

  test("raster budget: a 3x phone fits 3x even at 120 Hz", () => {
    const panel = { width: 402, height: 778 };
    expect(
      pickGuestVariant(variants, {
        pixelsPerLogical: 3,
        maxFps: 120,
        logicalArea: panel.width * panel.height,
      }),
    ).toMatchObject({ tickHz: 120, density: 3 });
  });
});
