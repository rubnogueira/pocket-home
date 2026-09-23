import { describe, expect, test } from "bun:test";
import { createScrollPhysics, fitVelocity, rubber } from "../app/ui/scroll-physics.ts";

// The web host runs one step per displayed frame when the display rate divides the tick rate
// (60 or 120 Hz), else 240; every behaviour must hold at each.
for (const HZ of [240, 120, 60]) {
  describe(`at ${HZ} steps/s`, () => {
    const EXTENT = 800;

    function harness(max: number, initial = 0) {
      let frame = 0;
      let value = initial;
      const s = createScrollPhysics(
        (v) => {
          value = v;
          return [() => value, (next: number) => (value = next)] as const;
        },
        { max: () => max, extent: () => EXTENT, now: () => frame / HZ, dt: () => 1 / HZ, initial },
      );
      /** Advance n virtual frames (step once per frame, like onFrame). */
      const run = (n: number, each?: () => void) => {
        for (let i = 0; i < n; i++) {
          frame++;
          each?.();
          s.step();
        }
      };
      /**
       * Finger drag at `pxPerSecond`, touch sampled at `inputHz` (positions only change on those
       * frames — the duplicated-virtual-frame situation that inflated the old velocity).
       */
      const drag = (pxPerSecond: number, seconds: number, inputHz = 60) => {
        s.beginDrag();
        const perInput = HZ / inputHz;
        const frames = Math.round(seconds * HZ);
        for (let i = 1; i <= frames; i++) {
          frame++;
          s.drag(i % perInput === 0 ? pxPerSecond / inputHz : 0);
        }
      };
      return { s, run, drag, offset: () => value };
    }

    describe("velocity", () => {
      test("time-window fit ignores duplicated virtual frames", () => {
        const samples = [];
        for (let i = 0; i <= 12; i++) samples.push({ t: i / 60, p: i * 20 }); // 1200 px/s at 60 Hz
        expect(fitVelocity(samples)).toBeCloseTo(1200, 3);
      });

      /** Touch samples at `hz` for `seconds`, finger position `pos(t)` (t = seconds, 0..end). */
      const sampled = (hz: number, seconds: number, pos: (t: number) => number, round = false) => {
        const out: { t: number; p: number }[] = [];
        for (let i = 0; i <= Math.round(seconds * hz); i++) {
          const t = i / hz;
          out.push({ t, p: round ? Math.round(pos(t)) : pos(t) });
        }
        return out;
      };

      test("an accelerating flick releases at the finger's speed at lift, not its average", () => {
        // 180 ms flick that accelerates from rest (p = k t^2): 2400 px/s at lift.
        const k = 2400 / (2 * 0.18);
        for (const hz of [60, 120]) {
          const v = fitVelocity(sampled(hz, 0.18, (t) => k * t * t));
          expect(v).toBeGreaterThan(2400 * 0.9);
          expect(v).toBeLessThan(2400 * 1.1);
        }
      });

      test("a finger slowing before lift releases slower", () => {
        // Decelerating over the last 100 ms: 1500 -> 500 px/s.
        const v = fitVelocity(sampled(60, 0.1, (t) => 1500 * t - (1000 / 0.2) * t * t));
        expect(v).toBeGreaterThan(500 * 0.8);
        expect(v).toBeLessThan(500 * 1.3);
      });

      test("whole-px sampling noise stays bounded (slow steady drag)", () => {
        for (const speed of [120, 300, 900]) {
          const v = fitVelocity(sampled(60, 0.3, (t) => speed * t, true));
          expect(v).toBeGreaterThan(speed * 0.75);
          expect(v).toBeLessThan(speed * 1.25);
        }
      });

      test("release velocity matches the finger at 60 Hz and 120 Hz input", () => {
        for (const inputHz of [60, 120].filter((hz) => hz <= HZ)) {
          const h = harness(100000);
          h.drag(1500, 0.3, inputHz);
          h.s.endDrag(0);
          expect(h.s.state()).toBe("fling");
          expect(h.s.velocity()).toBeGreaterThan(1500 * 0.9);
          expect(h.s.velocity()).toBeLessThan(1500 * 1.1);
        }
      });

      test("a finger that pauses before lifting does not fling", () => {
        const h = harness(100000);
        h.drag(2000, 0.2);
        h.run(24); // 100 ms still
        h.s.endDrag(2000);
        expect(h.s.state()).toBe("idle");
      });

      test("fling speed is capped like native lists", () => {
        const h = harness(1e6);
        h.drag(30000, 0.1);
        h.s.endDrag(0);
        expect(h.s.velocity()).toBeLessThanOrEqual(8000);
      });
    });

    describe("edges", () => {
      test("fling into the end bounces once, bounded, and settles on the edge", () => {
        const max = 2000;
        const h = harness(max, 500);
        h.drag(20000, 0.05); // 1000 px of finger travel at far above max speed
        expect(h.offset()).toBeLessThan(max); // the fling (not the drag) reaches the edge
        h.s.endDrag(0);
        expect(h.s.velocity()).toBe(8000);
        let peak = 0;
        let crossedBackIntoContent = false;
        let wentPast = false;
        h.run(HZ * 3, () => {
          const over = h.offset() - max;
          if (over > 0) wentPast = true;
          if (wentPast && h.offset() < max - 0.5) crossedBackIntoContent = true;
          peak = Math.max(peak, over);
        });
        expect(h.s.state()).toBe("idle");
        expect(h.offset()).toBe(max);
        expect(peak).toBeGreaterThan(0);
        expect(peak).toBeLessThan(EXTENT * 0.06); // framework scroller: 140 px at 6000 px/s
        expect(crossedBackIntoContent).toBe(false); // no wobble
      });

      test("fling into the top edge bounces once, bounded, and settles at 0", () => {
        const h = harness(2000, 1500);
        h.drag(-20000, 0.05);
        h.s.endDrag(0);
        expect(h.s.velocity()).toBe(-8000);
        let peak = 0;
        let crossedBackIntoContent = false;
        let wentPast = false;
        h.run(HZ * 3, () => {
          if (h.offset() < 0) wentPast = true;
          if (wentPast && h.offset() > 0.5) crossedBackIntoContent = true;
          peak = Math.max(peak, -h.offset());
        });
        expect(h.s.state()).toBe("idle");
        expect(h.offset()).toBe(0);
        expect(peak).toBeGreaterThan(0);
        expect(peak).toBeLessThan(EXTENT * 0.06);
        expect(crossedBackIntoContent).toBe(false);
      });

      test("content that fits does not bounce", () => {
        const h = harness(0);
        h.drag(-1500, 0.2);
        expect(h.offset()).toBe(0);
        h.s.endDrag(0);
        h.run(HZ);
        expect(h.offset()).toBe(0);
      });

      test("drag past the edge rubber-bands on the viewport scale and springs back", () => {
        const h = harness(1000, 0);
        h.drag(-2000, 0.2); // 400 px past the top
        expect(h.offset()).toBeCloseTo(-rubber(400, EXTENT), 1);
        expect(-h.offset()).toBeLessThan(400 * 0.55);
        h.s.endDrag(0);
        h.run(HZ);
        expect(h.offset()).toBe(0);
        expect(h.s.state()).toBe("idle");
      });
    });

    test("flings come to rest on whole pixels (crisp text)", () => {
      const h = harness(100000);
      h.drag(1234, 0.2);
      h.s.endDrag(0);
      h.run(HZ * 5);
      expect(h.s.state()).toBe("idle");
      expect(Number.isInteger(h.offset())).toBe(true);
    });

    describe("fling tail", () => {
      test("stops before crawling in sparse single-pixel hops", () => {
        const h = harness(100000);
        h.drag(1500, 0.3);
        h.s.endDrag(0);
        // Painted offset (whole px) per 60 Hz display frame, until the fling rests.
        const steps: number[] = [];
        let last = Math.round(h.offset());
        while (h.s.state() === "fling") {
          h.run(HZ / 60);
          const now = Math.round(h.offset());
          steps.push(now - last);
          last = now;
        }
        // The sub-pixel phase (painted steps of 0 between 1 px hops) is short: the old 12 px/s rest
        // threshold left ~0.9 s of ever sparser hops.
        const firstStill = steps.indexOf(0);
        expect(firstStill).toBeGreaterThan(0);
        expect(steps.length - firstStill).toBeLessThan(30); // < 0.5 s at 60 Hz
        expect(steps.every((d) => d >= 0 && d <= 30)).toBe(true); // monotonic, no jumps
      });
    });
  });
}

describe("step-rate independence", () => {
  /** Offset every 100 ms of a fling released at `v0` px/s, stepping `hz` times per second. */
  const trajectory = (hz: number, v0: number, max: number, initial: number) => {
    let frame = 0;
    let value = initial;
    const s = createScrollPhysics(
      (x) => {
        value = x;
        return [() => value, (next: number) => (value = next)] as const;
      },
      { max: () => max, extent: () => 800, now: () => frame / hz, dt: () => 1 / hz, initial },
    );
    s.beginDrag();
    for (let i = 1; i <= hz / 10; i++) {
      frame++;
      s.drag(v0 / hz);
    }
    s.endDrag(0);
    const out: number[] = [];
    for (let i = 1; i <= hz * 2; i++) {
      frame++;
      s.step();
      if (i % (hz / 10) === 0) out.push(value);
    }
    return out;
  };

  test("a fling follows the same path at 240 and 60 steps/s (mid-list and into the edge)", () => {
    for (const [max, initial] of [
      [100000, 0],
      [1200, 200],
    ]) {
      const fast = trajectory(240, 3000, max, initial);
      const slow = trajectory(60, 3000, max, initial);
      for (let k = 0; k < fast.length; k++) expect(Math.abs(fast[k] - slow[k])).toBeLessThan(3);
    }
  });
});
