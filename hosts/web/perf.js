// hosts/web/perf.js — frame-time diagnostics for the browser host (dev only, off by default).
//
//   ?perf=1      every 2 s, POST a summary of the display frames to the dev server (/__perf,
//                tools/serve.ts prints it) and log it to the console: rAF interval, dropped
//                frames, and where each frame's time went (app transactions, core ticks,
//                GPU draw: DrawList, batching, GL submit).
//   ?autodrag=1  replay a scripted finger (flicks, a slow drag, a hold) through the same contact
//                table pointer events feed, one sample per display frame like a real touch
//                screen — repeatable scroll runs on devices you cannot touch (headless
//                Simulator) or to compare builds.

const REPORT_MS = 2000;

function stats(values) {
  if (values.length === 0) return { avg: 0, p95: 0, max: 0 };
  const sorted = Float64Array.from(values).sort();
  let sum = 0;
  for (const v of sorted) sum += v;
  const at = (q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
  const r = (v) => Math.round(v * 100) / 100;
  return { avg: r(sum / sorted.length), p95: r(at(0.95)), max: r(sorted[sorted.length - 1]) };
}

function post(line) {
  try {
    fetch("__perf", { method: "POST", body: line, keepalive: true }).catch(() => {});
  } catch {
    // no dev server
  }
}

export function createPerf(enabled, info) {
  if (!enabled) return null;
  // Errors too: a phone has no console to read.
  addEventListener("error", (e) => post("ERROR " + (e.error?.stack ?? e.message)));
  addEventListener("unhandledrejection", (e) => post("REJECTION " + (e.reason?.stack ?? e.reason)));
  const consoleError = console.error.bind(console);
  console.error = (...args) => {
    consoleError(...args);
    post("console.error " + args.map((a) => a?.stack ?? String(a)).join(" "));
  };
  let windowStart = 0;
  let lastNow = 0;
  const dts = [];
  const parts = new Map(); // name -> per-frame totals
  let current = new Map();
  let frames = 0;
  let drawn = 0;
  let steps = [];
  const trace = []; // per displayed frame: [ms since window start, steps, scrollY, fingerY]
  // Main-thread heartbeat: when rAF is late, was the thread busy (long gap here too) or idle
  // (the compositor / GPU held the frame back)?
  const beats = [];
  let lastBeat = performance.now();
  setInterval(() => {
    const t = performance.now();
    beats.push(t - lastBeat);
    lastBeat = t;
  }, 4);

  function flush(now) {
    const refresh = info().refreshMs;
    const dropped = dts.filter((dt) => dt > refresh * 1.5).length;
    const summary = {
      ...info().labels,
      fps: Math.round((frames * 1000) / (now - windowStart)),
      drawn,
      dropped,
      rafDt: stats(dts),
      steps: stats(steps),
      mainThreadGap: stats(beats.splice(0)),
    };
    if (info().trace) summary.trace = trace.splice(0);
    for (const [name, values] of parts) summary[name] = stats(values);
    const line = JSON.stringify(summary);
    console.log("[perf] " + line);
    post(line);
    dts.length = 0;
    steps = [];
    parts.clear();
    frames = 0;
    drawn = 0;
    windowStart = now;
  }

  return {
    /** Start of a display frame (the rAF timestamp). */
    begin(now) {
      if (windowStart === 0) windowStart = now;
      if (lastNow > 0) dts.push(now - lastNow);
      lastNow = now;
      current = new Map();
    },
    /** Adds `ms` to this frame's `name` bucket. */
    add(name, ms) {
      current.set(name, (current.get(name) ?? 0) + ms);
    },
    end(now, stepCount, drew, fingerY) {
      frames++;
      if (info().trace) {
        const y = globalThis.__pocketScrollY;
        trace.push([
          Math.round(now),
          stepCount,
          y === undefined ? null : Math.round(y * 10) / 10,
          fingerY ?? null,
        ]);
      }
      if (drew) drawn++;
      steps.push(stepCount);
      let total = 0;
      for (const [name, ms] of current) {
        if (!parts.has(name)) parts.set(name, []);
        parts.get(name).push(ms);
        if (!name.includes(".")) total += ms;
      }
      if (!parts.has("work")) parts.set("work", []);
      parts.get("work").push(total);
      if (now - windowStart >= REPORT_MS) flush(now);
    },
  };
}

/**
 * Scripted finger in logical px: returns the contact for `t` ms since the script started, or
 * null when lifted. Loops forever.
 */
export function createAutoDrag(enabled, viewport) {
  if (!enabled) return null;
  // [duration ms, fromY, toY] as fractions of the height; null = finger up for that long.
  const script = [
    [null, 1500],
    [180, 0.8, 0.35], // fast flick up
    [null, 1800],
    [220, 0.8, 0.4], // fling again (reaches the end, edge bounce)
    [null, 1800],
    [160, 0.3, 0.8], // flick down
    [null, 1800],
    [1200, 0.75, 0.3], // slow tracking drag, then hold still before lifting
    [300, 0.3, 0.3],
    [null, 1200],
    [900, 0.3, 0.75],
    [null, 1500],
  ];
  const total = script.reduce((sum, s) => sum + (s[0] ?? s[1]), 0);
  let start = 0;
  return (now) => {
    if (start === 0) start = now;
    let t = (now - start) % total;
    for (const step of script) {
      const dur = step[0] ?? step[1];
      if (t < dur) {
        if (step[0] === null) return null;
        const { w, h } = viewport();
        const k = t / dur;
        // Flicks (< 300 ms) accelerate and lift while moving; slower drags track linearly.
        const ease = dur < 300 ? k * k : k;
        return { x: w / 2, y: h * (step[1] + (step[2] - step[1]) * ease) };
      }
      t -= dur;
    }
    return null;
  };
}
