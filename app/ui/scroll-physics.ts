/**
 * Phone-like kinetic scrolling (drop-in for the framework `Scroller`).
 *
 * The framework scroller (kinetics-core.ts) felt bouncy on real screens, for three reasons
 * this module addresses:
 *
 *  1. Release velocity. The gesture layer measures velocity over the last 3 VIRTUAL frames.
 *     The web build runs 240 virtual frames/s while touch positions only change once per
 *     display frame (60/120 Hz), so the latest finger movement was divided by ~12 ms instead
 *     of the real 8–17 ms between samples: flings launched up to 2x too fast (or at 0).
 *     Here velocity comes from a time-window fit over de-duplicated samples (Android's
 *     VelocityTracker approach), a finger that paused before lifting releases with no fling,
 *     and speed is capped like native lists.
 *  2. Rubber band scale. The framework defaults the rubber-band extent to SCREEN_H (272 px,
 *     the PSP screen); here it is the real viewport height.
 *  3. Edge bounce. A fling entering the edge carried its full velocity into an uncapped spring
 *     (140 px overshoot at 6000 px/s). Here the overshoot runs through the same rubber-band
 *     curve as dragging and a critically damped spring — one short, bounded bounce, no wobble.
 *     Content that fits the viewport does not bounce at all (UIScrollView's default).
 *
 * Time is virtual (virtualNow / simulationHz), so trajectories stay deterministic per host.
 */
import type { Scroller, ScrollerState } from "@pocketjs/framework/kinetics";

export type ScrollCell = (initial: number) => readonly [() => number, (value: number) => void];

export interface ScrollPhysicsOptions {
  /** Scroll range end: max(0, contentH - viewH). Read every step. */
  max: () => number;
  /** Viewport extent along the axis (rubber-band scale). */
  extent: () => number;
  /** Virtual seconds now (framework clock `virtualNow`). */
  now: () => number;
  /** Seconds per step() call (1 / simulationHz). */
  dt: () => number;
  initial?: number;
  onSettle?: (offset: number) => void;
}

/** UIScrollView "normal" deceleration: velocity x 0.998 per ms. */
const DECELERATION_PER_MS = 0.998;
/** Native lists cap fling speed (Android ViewConfiguration max fling ~8000 dp/s). */
const MAX_FLING_VELOCITY = 8000;
/** Below this release speed a lift is a stop, not a fling (px/s). */
const MIN_FLING_VELOCITY = 50;
/** A fling at rest (px/s). The core paints whole logical px, so below ~0.4 px per 60 Hz frame a
 *  fling only crawls in single-pixel hops at ever longer intervals (~0.4 s and ~6 px from here to
 *  12 px/s) — it reads as stutter, not motion. Stop there instead. */
const REST_VELOCITY = 24;
/** Velocity fit window and "finger paused" threshold (s). */
const VELOCITY_WINDOW = 0.1;
const PAUSE_BEFORE_LIFT = 0.05;
/** iOS rubber-band coefficient. */
const RUBBER_COEFF = 0.55;
/** Edge spring: critically damped, rad/s (settles in ~0.3 s without overshooting back). */
const SPRING_OMEGA = 24;
/** Share of a fling's speed kept when it hits the edge (the rest is absorbed), so a fast
 *  fling ends in a short bump (~40 px at max speed, ~15 px at 3000 px/s) instead of a leap. */
const EDGE_ABSORB = 0.6;
const SPRING_SETTLE_PX = 0.5;
const SPRING_SETTLE_V = 10;
/** apps/im chase pump (d-pad / focus follow): share of the distance closed per 1/240 s, so the
 *  pace is the same at any simulation rate (it was per step: 4x slower at 60 steps/s). */
const CHASE_RATE = 0.3;
const CHASE_RATE_HZ = 240;
const CHASE_SNAP = 0.6;

/** Displayed travel for `x` px of out-of-range travel (asymptote `d`). */
export function rubber(x: number, d: number): number {
  if (d <= 0 || x <= 0) return 0;
  return (1 - 1 / ((x * RUBBER_COEFF) / d + 1)) * d;
}

/** Inverse of rubber(): travel that displays as `e` px. */
export function rubberInverse(e: number, d: number): number {
  if (e <= 0 || d <= 0) return 0;
  const clamped = Math.min(e, d * 0.999);
  return (d * clamped) / (RUBBER_COEFF * (d - clamped));
}

/**
 * Release velocity from (t, p) samples within VELOCITY_WINDOW of the newest one. Samples are
 * de-duplicated positions, so repeated virtual frames between input events do not distort it.
 *
 * A straight-line fit reports the speed at the middle of the window: a flick accelerates up to
 * the lift, so it released 25-45% slower than the finger was moving (the content "braked" as the
 * finger left), and a finger slowing before lifting released too fast. A quadratic fit (Android's
 * LSQ2 VelocityTracker strategy), differentiated at the newest sample, follows both. It needs
 * four samples, and is kept within [0.5x, 2x] of the straight-line fit in the same direction so
 * whole-px sampling noise cannot turn into a wild fling (0 when the finger was reversing).
 */
export function fitVelocity(samples: readonly { t: number; p: number }[]): number {
  if (samples.length < 2) return 0;
  const tEnd = samples[samples.length - 1].t;
  const pEnd = samples[samples.length - 1].p;
  // Power sums of t (relative to the newest sample, so t <= 0) and moments of p (relative too).
  let n = 0;
  let s1 = 0;
  let s2 = 0;
  let s3 = 0;
  let s4 = 0;
  let p0 = 0;
  let p1 = 0;
  let p2 = 0;
  for (let i = samples.length - 1; i >= 0; i--) {
    const sample = samples[i];
    if (tEnd - sample.t > VELOCITY_WINDOW) break;
    const t = sample.t - tEnd;
    const p = sample.p - pEnd;
    const tt = t * t;
    n++;
    s1 += t;
    s2 += tt;
    s3 += tt * t;
    s4 += tt * tt;
    p0 += p;
    p1 += t * p;
    p2 += tt * p;
  }
  if (n < 2) return 0;
  const linDenom = n * s2 - s1 * s1;
  const linear = linDenom > 1e-12 ? (n * p1 - s1 * p0) / linDenom : 0;
  if (n < 4) return linear;
  // Normal equations for p = a + b t + c t^2; b (the slope at t = 0) by Cramer's rule.
  const det = n * (s2 * s4 - s3 * s3) - s1 * (s1 * s4 - s3 * s2) + s2 * (s1 * s3 - s2 * s2);
  if (Math.abs(det) < 1e-18) return linear;
  const detB = n * (p1 * s4 - s3 * p2) - p0 * (s1 * s4 - s3 * s2) + s2 * (s1 * p2 - p1 * s2);
  const quadratic = detB / det;
  if (linear === 0) return 0;
  // Opposite slope at the lift: the finger was turning around — no fling either way.
  if (Math.sign(quadratic) !== Math.sign(linear)) return 0;
  const lo = Math.abs(linear) * 0.5;
  const hi = Math.abs(linear) * 2;
  return Math.sign(linear) * Math.min(hi, Math.max(lo, Math.abs(quadratic)));
}

export function createScrollPhysics(cell: ScrollCell, opts: ScrollPhysicsOptions): Scroller {
  const [offset, setOffset] = cell(opts.initial ?? 0);
  let pos = opts.initial ?? 0;
  let state: ScrollerState = "idle";
  let v = 0; // px per second
  let dragPos = 0; // un-rubbered drag-space position
  let samples: { t: number; p: number }[] = [];
  let lastSampleT = 0;
  // Edge spring runs in drag space (u = travel past the edge) and displays through rubber().
  let edge = 0;
  let u = 0;
  let target = 0; // chase target
  let tweenFrom = 0;
  let tweenTo = 0;
  let tweenT = 0;
  let tweenDur = 0;

  const max = () => Math.max(0, opts.max());
  const clampRange = (x: number) => Math.min(max(), Math.max(0, x));
  const canOverscroll = () => max() > 0;

  function emit(p: number): void {
    if (p !== pos) {
      pos = p;
      setOffset(p);
    }
  }

  function settle(p: number): void {
    // Rest on whole logical px so text lands on the pixel grid (crisp).
    const r = Math.round(p);
    emit(r);
    v = 0;
    state = "idle";
    opts.onSettle?.(r);
  }

  function displayedFromDrag(): number {
    const m = max();
    if (!canOverscroll()) return clampRange(dragPos);
    if (dragPos < 0) return -rubber(-dragPos, opts.extent());
    if (dragPos > m) return m + rubber(dragPos - m, opts.extent());
    return dragPos;
  }

  /** Edge spring from the current position; `atEdge` names the edge when pos sits exactly on it. */
  function startSpring(velocity: number, atEdge?: number): void {
    const m = max();
    edge = atEdge ?? (pos < 0 ? 0 : m);
    // Back into drag space so the spring continues the curve the user saw.
    const over = Math.max(0, edge === 0 ? -pos : pos - m);
    u = rubberInverse(over, opts.extent());
    // Velocity along the outward direction.
    v = edge === 0 ? -velocity : velocity;
    state = "spring";
  }

  function startTween(to: number, durMs: number): void {
    tweenFrom = pos;
    tweenTo = clampRange(to);
    tweenT = 0;
    tweenDur = Math.max(1e-3, durMs / 1000);
    state = tweenTo === pos ? "idle" : "tween";
  }

  /** Fling decay rate k (1/s): v(t) = v0 e^(-k t). */
  const DECAY_K = -Math.log(DECELERATION_PER_MS) * 1000;

  /**
   * Critically damped edge spring advanced by `dt` in closed form — u(t) = (u0 + c t) e^(-w t),
   * c = v0 + w u0 — so the bounce is the same at any step rate (Euler steps at 60 Hz overshot).
   */
  function springAdvance(dt: number): void {
    const e = Math.exp(-SPRING_OMEGA * dt);
    const c = v + SPRING_OMEGA * u;
    u = (u + c * dt) * e;
    v = (v - SPRING_OMEGA * c * dt) * e;
  }

  /** Spring frame: advance, then settle or display the rubber-banded overshoot. */
  function springFrame(dt: number): void {
    springAdvance(dt);
    if (u <= 0) {
      // Crossed back to the edge: arrive, no rebound into the content.
      settle(edge);
      return;
    }
    const shown = rubber(u, opts.extent());
    if (shown < SPRING_SETTLE_PX && Math.abs(v) < SPRING_SETTLE_V) {
      settle(edge);
      return;
    }
    emit(edge === 0 ? -shown : edge + shown);
  }

  function projectFling(v0: number): number {
    // ∫ v0·D^t dt over t in ms  =  v0 / (-ln D) (per ms -> px).
    return pos + v0 / (-Math.log(DECELERATION_PER_MS) * 1000);
  }

  const scroller: Scroller = {
    offset,
    velocity: () => v,
    state: () => state,

    beginDrag(): void {
      const m = max();
      v = 0;
      state = "tracking";
      samples = [];
      if (canOverscroll() && pos < 0) dragPos = -rubberInverse(-pos, opts.extent());
      else if (canOverscroll() && pos > m) dragPos = m + rubberInverse(pos - m, opts.extent());
      else dragPos = pos;
      lastSampleT = opts.now();
      samples.push({ t: lastSampleT, p: dragPos });
    },

    drag(deltaPx: number): void {
      if (state !== "tracking") scroller.beginDrag();
      dragPos += deltaPx;
      if (deltaPx !== 0) {
        lastSampleT = opts.now();
        samples.push({ t: lastSampleT, p: dragPos });
        if (samples.length > 32) samples.splice(0, samples.length - 32);
      }
      emit(displayedFromDrag());
    },

    endDrag(releaseVelocity: number): void {
      if (state !== "tracking") return;
      // Own estimate from real sample times; the caller's (virtual-frame) velocity is only a
      // fallback when the drag produced no samples at all.
      let velocity = samples.length >= 2 ? fitVelocity(samples) : releaseVelocity;
      if (opts.now() - lastSampleT > PAUSE_BEFORE_LIFT) velocity = 0;
      velocity = Math.max(-MAX_FLING_VELOCITY, Math.min(MAX_FLING_VELOCITY, velocity));
      samples = [];
      const m = max();
      if (pos < 0 || pos > m) {
        startSpring(velocity);
        return;
      }
      if (Math.abs(velocity) >= MIN_FLING_VELOCITY) {
        v = velocity;
        state = "fling";
        return;
      }
      settle(pos);
    },

    scrollTo(to: number, o?: { durMs?: number } | { immediate: true }): void {
      if (o && "immediate" in o && o.immediate) {
        v = 0;
        state = "idle";
        emit(clampRange(to));
        return;
      }
      startTween(to, (o as { durMs?: number } | undefined)?.durMs ?? 250);
    },

    scrollBy(delta: number, o?: { durMs?: number } | { immediate: true }): void {
      const base = state === "tween" ? tweenTo : state === "chase" ? target : pos;
      scroller.scrollTo(base + delta, o);
    },

    stop(): void {
      v = 0;
      if (pos < 0 || pos > max()) startSpring(0);
      else state = "idle";
    },

    nudge(delta: number): void {
      const base = state === "chase" ? target : pos;
      scroller.chaseTo(base + delta);
    },

    chaseTo(to: number): void {
      target = clampRange(to);
      if (state !== "chase" && target === pos) return;
      v = 0;
      state = "chase";
    },

    rebase(delta: number): void {
      dragPos += delta;
      target += delta;
      tweenFrom += delta;
      tweenTo += delta;
      for (const s of samples) s.p += delta;
      emit(pos + delta);
    },

    intent(): number {
      return state === "chase" ? target : state === "tween" ? tweenTo : pos;
    },

    isAtEnd(slackPx = 1): boolean {
      return scroller.intent() >= max() - slackPx;
    },

    projectFling,

    step(): void {
      if (state === "idle" || state === "tracking") return;
      const dt = opts.dt();

      if (state === "chase") {
        target = clampRange(target);
        const d = target - pos;
        if (Math.abs(d) < CHASE_SNAP) {
          emit(target);
          state = "idle";
          opts.onSettle?.(pos);
          return;
        }
        emit(pos + d * (1 - Math.pow(1 - CHASE_RATE, dt * CHASE_RATE_HZ)));
        return;
      }

      if (state === "tween") {
        tweenT += dt;
        if (tweenT >= tweenDur) {
          settle(tweenTo);
          return;
        }
        const inv = 1 - tweenT / tweenDur;
        emit(tweenFrom + (tweenTo - tweenFrom) * (1 - inv * inv * inv));
        return;
      }

      if (state === "fling") {
        // Exact exponential decay over dt (not per-step Euler), so the throw is the same at
        // any step rate: x(dt) = v (1 - e^(-k dt)) / k.
        const e = Math.exp(-DECAY_K * dt);
        const next = pos + (v * (1 - e)) / DECAY_K;
        const m = max();
        if (next < 0 || next > m) {
          if (!canOverscroll()) {
            settle(clampRange(next));
            return;
          }
          // Stop exactly at the edge (a 60 Hz step of a fast fling lands 100+ px past it) and
          // give the rest of the step to the spring, entering at the speed the fling had there.
          const edgeAt = next < 0 ? 0 : m;
          const reach = ((edgeAt - pos) * DECAY_K) / v; // 1 - e^(-k t_edge), in [0, 1)
          const tEdge = reach > 0 && reach < 1 ? -Math.log(1 - reach) / DECAY_K : 0;
          const vEdge = v * Math.exp(-DECAY_K * tEdge);
          emit(edgeAt);
          startSpring(vEdge * EDGE_ABSORB, edgeAt);
          springFrame(Math.max(0, dt - tEdge));
          return;
        }
        v *= e;
        if (Math.abs(v) < REST_VELOCITY) {
          settle(next);
          return;
        }
        emit(next);
        return;
      }

      // spring: critically damped on the drag-space overshoot u (>= 0 outward).
      springFrame(dt);
    },
  };
  return scroller;
}
