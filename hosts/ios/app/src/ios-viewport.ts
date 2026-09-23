/**
 * Logical viewport for the Pocket surface — pure, no NativeScript imports (unit-tested from
 * `tests/ios-shell-viewport.test.ts`).
 *
 * The surface fills the safe-area panel and its logical size is the panel in DIPs (points), so
 * one logical px is exactly `screen.scale` device pixels and a guest at that density maps 1:1
 * onto the panel. Any other ratio makes Core Animation resample every frame: text goes soft and
 * shimmers while scrolling, because each scroll step lands at a different sub-pixel phase.
 *
 * The touch wire (framework/src/touch.ts wide form, 11 bits per axis with the Pocket Home patch)
 * addresses MAX_LOGICAL_AXIS px; only a panel wider than that is scaled down, by one UI scale
 * taken from the *window* (orientation-independent), so rotating keeps text the same size.
 */

export interface Size {
  readonly width: number;
  readonly height: number;
}

export interface SurfaceViewport {
  /** Logical px handed to the guest (`viewportWidth` / `viewportHeight`, `ui.__viewport`). */
  readonly logical: Size;
  /** Panel DIPs per logical px (1 when the panel already fits the touch wire). */
  readonly scale: number;
}

export const MAX_LOGICAL_AXIS = 2047;

/** Panels smaller than this (mid-rotation, zero-size first layout) are not mounted. */
export const MIN_PANEL_AXIS = 64;

export function isMountablePanel(panel: Size): boolean {
  return (
    Number.isFinite(panel.width) &&
    Number.isFinite(panel.height) &&
    panel.width >= MIN_PANEL_AXIS &&
    panel.height >= MIN_PANEL_AXIS
  );
}

export function surfaceViewport(panel: Size, window: Size = panel): SurfaceViewport {
  const longest = Math.max(window.width, window.height, panel.width, panel.height);
  const scale = longest > MAX_LOGICAL_AXIS ? longest / MAX_LOGICAL_AXIS : 1;
  const axis = (dips: number) =>
    Math.max(1, Math.min(MAX_LOGICAL_AXIS, Math.floor(dips / scale + 1e-6)));
  return {
    logical: { width: axis(panel.width), height: axis(panel.height) },
    scale,
  };
}

export function sameSize(a: Size | null | undefined, b: Size | null | undefined): boolean {
  return !!a && !!b && a.width === b.width && a.height === b.height;
}

/** One staged guest build (tools/ios-app/stage-guest.ts); names are under assets/pocket/. */
export interface GuestVariant {
  readonly density: number;
  readonly tickHz: number;
  readonly bundle: string;
  readonly pak: string;
}

/**
 * CPU raster cost per device pixel of the software rasterizer (measured on Apple silicon: ~4.8 ms
 * for a 2085x1398 frame), for a CPU-rendered surface. The shell draws with Metal (Pocket Home's
 * PocketApple framework) and passes no `logicalArea`, so no budget applies.
 */
export const RASTER_NS_PER_PIXEL = 1.7;
/** Share of the frame budget a full-surface repaint (scroll) may take. */
export const RASTER_BUDGET_SHARE = 0.7;

/**
 * Pick the guest for this device and surface:
 *
 *  - density: the smallest staged density >= the surface's device pixels per logical px
 *    (screen scale x surface stretch). With an unscaled surface that is exactly the screen
 *    scale, so the framebuffer lands 1:1 on device pixels.
 *  - tick rate: the highest staged rate the display can refresh at (120 on ProMotion) at which
 *    a full repaint at that density (every scrolling frame repaints everything) fits the frame
 *    budget. Sharpness wins over rate: a lower density would be stretched (blurred, shimmering
 *    while scrolling), and a rate whose frames overrun the budget drops frames mid-scroll, which
 *    reads as less fluid than a steady lower rate. The bundle bakes its rate and the display link
 *    is pinned to it, so a rate the screen cannot reach is never picked (unless it is the only one).
 *  - Nothing fits even at the lowest rate: that rate, at the densest density that fits (at
 *    least the smallest).
 */
export function pickGuestVariant(
  variants: readonly GuestVariant[],
  device: {
    readonly pixelsPerLogical: number;
    readonly maxFps: number;
    /** Logical px of the surface (for the raster budget); omit to skip the budget. */
    readonly logicalArea?: number;
  },
): GuestVariant | null {
  if (variants.length === 0) return null;
  const rates = [...new Set(variants.map((v) => v.tickHz))].sort((a, b) => a - b);
  const reachable = rates.filter((hz) => hz <= device.maxFps);
  const ratesDesc = (reachable.length > 0 ? reachable : [rates[0]]).reverse();
  const at = (hz: number) =>
    variants.filter((v) => v.tickHz === hz).sort((a, b) => a.density - b.density);
  const wanted = Math.ceil(device.pixelsPerLogical - 0.05);
  const sharpest = (candidates: GuestVariant[]) =>
    candidates.find((v) => v.density >= wanted) ?? candidates[candidates.length - 1];
  const fits = (v: GuestVariant) =>
    device.logicalArea === undefined ||
    device.logicalArea * v.density * v.density * RASTER_NS_PER_PIXEL <=
      (1e9 / v.tickHz) * RASTER_BUDGET_SHARE;

  for (const hz of ratesDesc) {
    const pick = sharpest(at(hz));
    if (fits(pick)) return pick;
  }
  const slowest = at(ratesDesc[ratesDesc.length - 1]);
  const affordable = slowest.filter((v) => v.density <= sharpest(slowest).density && fits(v));
  return affordable.length > 0 ? affordable[affordable.length - 1] : slowest[0];
}
