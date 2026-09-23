/**
 * Vue binding for the phone-like scroller (scroll-physics.ts). Same `Scroller` interface as
 * `@pocketjs/framework/kinetics` `createScroller`, so gestures, `bindDpadScroll` and call
 * sites are unchanged; `extent` (the visible height) now drives the rubber band.
 */
import { shallowRef } from "vue";
import type { Scroller } from "@pocketjs/framework/kinetics";
import { simulationHz, virtualNow } from "@pocketjs/framework/clock";
import { createScrollPhysics } from "./scroll-physics.ts";

const DPAD_SCROLL_PX_PER_S = 1440;

/**
 * bindDpadScroll options for a held d-pad / arrow key: it nudges by a fixed step per frame, so
 * the step is derived from a speed (the pace the 240 Hz web build always had) and the rate.
 */
export function dpadScrollOptions(active: () => boolean) {
  const perFrame = DPAD_SCROLL_PX_PER_S / simulationHz();
  return { active, stepPx: perFrame, nubPx: (perFrame * 10) / 6 };
}

export interface ScrollerOptions {
  /** Scroll range end: max(0, contentH - viewH). */
  max: () => number;
  /** Visible extent along the scroll axis, in logical px. */
  extent: () => number;
  initial?: number;
  onSettle?: (offset: number) => void;
}

export function createScroller(opts: ScrollerOptions): Scroller {
  return createScrollPhysics(
    (initial) => {
      const cell = shallowRef(initial);
      return [() => cell.value, (next: number) => (cell.value = next)] as const;
    },
    {
      ...opts,
      now: virtualNow,
      dt: () => 1 / simulationHz(),
    },
  );
}

/**
 * The offset to paint. The core rounds every box and every glyph to the pixel grid on its own,
 * and glyph origins carry fractional line-height offsets, so a fractional scroll offset made text
 * step against its card by a pixel from frame to frame while moving — unless the host draws
 * sub-pixel translates (the browser's WebGL backend with the patched core: the subtree paints at
 * whole px and the fraction is applied to it as a whole, at device-pixel precision). Elsewhere
 * (iOS, the software rasterizer) the offset is rounded so everything moves by the same amount.
 */
export function paintOffset(scroller: Scroller): number {
  const offset = scroller.offset();
  return (globalThis as { __pocketSubpixelTranslate?: boolean }).__pocketSubpixelTranslate
    ? offset
    : Math.round(offset);
}
