// hosts/web/engine.js — the browser dev host for PocketJS.
//
// Loads pocketjs.wasm (core + software rasterizer), installs the HostOps
// binding (wasm-ops.js — shared with tests/golden.ts) as globalThis.ui,
// installs the demo's .pak as globalThis.__pak, evals the demo bundle
// (which mounts the app and installs globalThis.frame), then drives a
// fixed-timestep loop that BLITS ONCE PER rAF (so the visual rate follows the
// panel — 60/120/240 Hz — with no hard cap): frame(buttons) -> ui_tick ->
// ui_render -> putImageData onto a viewport-sized canvas. simHz defaults to the
// build's tick rate (bun run dev bakes 240), and the core step size is synced
// to it (setTickRate) so animations stay wall-clock correct at any refresh.
//
// Loop shape (dt clamp 250 ms, simHz-scaled catch-up cap) is adapted from the
// proven dreamcart web/engine.js driver.
//
// Keyboard map (also listed on the page):
//   arrows = d-pad     Enter / Z = CIRCLE  X = CROSS
//   A = SQUARE         S = TRIANGLE        Shift = SELECT   Space = START

import { createWasmUi, FB_W as DEFAULT_FB_W, FB_H as DEFAULT_FB_H } from "./wasm-ops.js";
import { wasmMemoryBytes } from "./hud.js";
import { createAudioHost } from "./audio.js";
import { createNetHost } from "./net.js";
import { createGpuRenderer } from "./gpu.js";
import { createAutoDrag, createPerf } from "./perf.js";

const query = new URLSearchParams(location.search);
function positiveIntParam(name, fallback, max = 32000) {
  const value = Number(query.get(name));
  return Number.isInteger(value) && value > 0 && value <= max ? value : fallback;
}

// Density and scale are automatic (no ?scale / ?density needed):
//
//   * Raster density — the resolution glyph atlases and rounded-corner masks are baked at — is
//     ceil(devicePixelRatio), 1..MAX_DENSITY; tools/build.ts bakes one pak per density
//     (dist/density/<d>/). Text is then never upsampled: on a 1x panel it is not a downsampled
//     2x atlas (soft), on a 3x panel not an upscaled 2x one (blurry).
//   * GPU path (gpu.js, WebGL2): the canvas backing store is the element's exact device-pixel
//     size and the DrawList is drawn at logical × devicePixelRatio (fractional ratios too), so
//     the browser never resamples the frame. Full resolution at every refresh rate.
//   * CPU fallback (no WebGL2): integer render scale = density, as before.
//
// The density follows the screen: moving the window to a panel with another ratio reloads the
// app at that density (state carried over, see svc bridge below). ?density=N / ?scale=N still
// pin a value for debugging; ?gpu=0 forces the software rasterizer.
export const MAX_DENSITY = 3;
export function autoDensity(dpr = window.devicePixelRatio || 1) {
  return Math.max(1, Math.min(MAX_DENSITY, Math.ceil(dpr - 0.05)));
}
const densityPinned = query.has("density") || query.has("scale");
function defaultRenderScale() {
  return autoDensity();
}

// LOGICAL_* and FB_* are mutable: setViewport() re-sizes the live viewport
// without a page reload (see hosts/web/index.html). RENDER_SCALE stays fixed
// for the session — it is baked into the raster density at ui_init().
let LOGICAL_W = positiveIntParam("width", DEFAULT_FB_W);
let LOGICAL_H = positiveIntParam("height", DEFAULT_FB_H);
// RENDER_SCALE is mutable: setRenderScale() toggles the retina framebuffer
// on/off live (the HiDPI checkbox). RASTER_DENSITY tracks it for AA sampling.
let RENDER_SCALE = positiveIntParam("scale", defaultRenderScale(), 4);
let RASTER_DENSITY = positiveIntParam("density", RENDER_SCALE, MAX_DENSITY);
let FB_W = LOGICAL_W * RENDER_SCALE;
let FB_H = LOGICAL_H * RENDER_SCALE;
let needsFullRender = false; // set after a live resize so the next blit repaints whole

// Motion-adaptive render scale. A full-viewport software raster is the scroll
// bottleneck: it costs O(scale²) and the incremental renderer can't help,
// because a scroll translates every child so the whole viewport is damaged
// every frame. The OLD policy always collapsed to 1× while moving — smooth on a
// slow phone, but needlessly BLURRY on a machine that could raster the scroll
// at full scale. The NEW policy MEASURES the raster+blit wall time each frame
// and, while moving, holds the LARGEST scale whose cost still fits the panel's
// frame budget (a hysteretic hill-climb): a fast Mac scrolls crisp at full
// scale, a slow phone drops as far as it must to keep frames on time, and each
// finds its own ceiling with no hard-coded assumption. When fully still it snaps
// back to the full RENDER_SCALE. drawHash() (~0.04 ms, no rasterize) is the
// motion signal.
//
// Motion is a change-RATE low-pass, not a single changed frame: how many of the
// last MOTION_WINDOW frames changed the DrawList. A real scroll changes every
// frame; an isolated blip (a clock digit, the last sub-pixel twitch of a
// settling fling) changes one frame in many. We only treat it as motion at
// >= MOTION_ENTER changes in the window, and only snap to full scale when the
// window is completely clear (0 changes) — between the two we HOLD (hysteresis)
// so nothing oscillates at the boundary. fbScale is the scale the canvas is
// currently allocated at; motionScale is the adaptive target while moving.
const MOTION_WINDOW = 6; // frames of history for the change-rate low-pass
const MOTION_ENTER = 2; // >= this many changed frames in the window → motion
let fbScale = RENDER_SCALE;
let motionScale = RENDER_SCALE; // adaptive raster scale while moving
let lastDrawHash = null;
const motionRing = new Uint8Array(MOTION_WINDOW);
let motionRingPos = 0;
let motionChanges = 0; // running sum of motionRing

// Frame-budget controller. `displayIntervalMs` estimates the panel's IDEAL rAF
// cadence (its refresh period) by tracking the FAST cadence: a cheap frame
// reveals the true interval, so it snaps down to any shorter dt and creeps only
// slowly toward longer ones — a run of slow scroll frames must not inflate the
// budget it is being judged against. `lastRenderMs` is the measured raster+blit
// cost of the most recent painted frame (EMA-smoothed), used to decide the
// motion scale.
let displayIntervalMs = 1000 / 60;
let lastRenderMs = 0;
const RENDER_COST_EMA = 0.4; // weight of the newest cost sample
const BUDGET_DROP = 1.3; // drop scale when cost exceeds budget × this
const BUDGET_RAISE = 0.9; // raise only if the PREDICTED higher cost fits
// Refresh period for the clock (vsyncSteps): the mean of recent rAF intervals near their median,
// so outliers (a dropped frame, a tab switch) do not pull it and a new display is picked up
// within a few frames.
let refreshMs = 1000 / 60;
const REFRESH_SAMPLES = 31;
const refreshRing = new Float64Array(REFRESH_SAMPLES);
let refreshCount = 0;
const refreshSorted = new Float64Array(REFRESH_SAMPLES);
let hudDirty = true; // repaint the on-canvas HUD on the next blit
let idleSkips = 0; // consecutive blits skipped (idle safety net)
const IDLE_SKIP_CAP = 240; // force a repaint at least this often when idle

// The core can shrink its live viewport (and grow back to a size already seen),
// but not grow past the size it was initialised at. So init at a generous
// maximum covering the physical screen and the largest preset (in either
// orientation); every later setViewport is then a shrink or grow-within-max.
// The framebuffer stays at the *current* logical size — the cap only raises
// the ceiling, it does not enlarge what we allocate or paint.
function initMaxDim() {
  const s = Math.max(
    screen.width || 0,
    screen.height || 0,
    window.innerWidth || 0,
    window.innerHeight || 0,
  );
  return Math.max(1920, Math.min(4096, s));
}
const INIT_MAX = positiveIntParam("initmax", initMaxDim(), 16000);

// contracts/spec/spec.ts BTN (plain module — keep the literal in sync with the spec).
export const BTN = {
  SELECT: 0x0001,
  START: 0x0008,
  UP: 0x0010,
  RIGHT: 0x0020,
  DOWN: 0x0040,
  LEFT: 0x0080,
  LTRIGGER: 0x0100,
  RTRIGGER: 0x0200,
  TRIANGLE: 0x1000,
  CIRCLE: 0x2000,
  CROSS: 0x4000,
  SQUARE: 0x8000,
};

const KEYMAP = {
  ArrowUp: BTN.UP,
  ArrowRight: BTN.RIGHT,
  ArrowDown: BTN.DOWN,
  ArrowLeft: BTN.LEFT,
  KeyX: BTN.CROSS,
  Enter: BTN.CIRCLE,
  KeyZ: BTN.CIRCLE,
  KeyA: BTN.SQUARE,
  KeyS: BTN.TRIANGLE,
  ShiftLeft: BTN.SELECT,
  ShiftRight: BTN.SELECT,
  Space: BTN.START,
  // Shoulder triggers: the literal L / R keys the shoulders are named after,
  // plus Q / E as an ergonomic left-hand alternate.
  KeyL: BTN.LTRIGGER,
  KeyR: BTN.RTRIGGER,
  KeyQ: BTN.LTRIGGER,
  KeyE: BTN.RTRIGGER,
};

// Analog nub emulation: I/K tilt the Y axis, J/O the X axis (L is taken by
// the shoulder trigger). The packed value ((x << 8) | y, 128 = center — spec
// ANALOG_CENTER) rides as frame()'s second argument; with no key held it
// stays centered, so demos that ignore the nub see the pre-analog behavior.
const NUBMAP = {
  KeyI: [0, -1],
  KeyK: [0, 1],
  KeyJ: [-1, 0],
  KeyO: [1, 0],
};
const nubHeld = new Set();

function packedAnalog() {
  let x = 0;
  let y = 0;
  for (const code of nubHeld) {
    const [dx, dy] = NUBMAP[code];
    x += dx;
    y += dy;
  }
  const px = 128 + Math.max(-1, Math.min(1, x)) * 127;
  const py = 128 + Math.max(-1, Math.min(1, y)) * 127;
  return ((px & 0xff) << 8) | (py & 0xff);
}

let wasm = null; // createWasmUi result
let canvas = null;
let ctx = null; // 2D context (CPU fallback only)
let gpu = null; // gpu.js renderer (WebGL2); null = CPU fallback
let presentWaiters = []; // whenPresented() callers
let hudEl = null; // FPS / memory pills (DOM text: rendered natively, sharp at any pixel ratio)
let hudFpsEl = null;
let hudMemEl = null;
let displayCss = null; // { w, h } CSS size the page shows the canvas at (setDisplaySize)
const displayListeners = new Set();
let held = 0;
let rafId = 0;
let acc = 0;
let last = 0;
let frameCb = null;
let audioHost = null; // hosts/web/audio.js — created on first load()
let netHost = null; // hosts/web/net.js — browser fetch behind the NET contract

// ---- wheel state ----------------------------------------------------------------
// Mouse wheel / trackpad scroll: accumulate Y delta between frames so the app
// can drain it once per frame and apply it to the kinetic scroller. Normalised
// to pixels (DOM_DELTA_LINE × 40, DOM_DELTA_PAGE × viewport height).
let wheelAccumY = 0;
const WHEEL_LINE_PX = 40;

// ---- touch state ----------------------------------------------------------------
// Track active pointer/touch contacts on the canvas and deliver them to
// frame() as packed wide-format integers (bit31=1, x:10, y:10, id:8, plus the 11th x / y bit
// in bits 28 / 29 — patched framework/src/touch.ts), so windows up to 2047 logical px wide.
//
// Latching: a contact that appears and disappears between frames is held for
// one frame so the gesture layer sees a down edge.  A "pending release"
// contact is delivered once more and then removed after the frame consumes it.
const activeContacts = new Map(); // pointerId -> {x, y, release}
const WIDE_MARKER = 0x80000000;
const WIDE_COORD_BITS = 10;
const WIDE_COORD_MASK = (1 << WIDE_COORD_BITS) - 1;
const WIDE_COORD_MAX = 2047;

/**
 * Logical point of a pointer event: `x`/`y` whole px for the touch wire, `fx`/`fy` exact —
 * CSS px are fractional on a 3x screen, and rounding them moved drags in 3-device-px steps
 * (see __pocketTouchPrecise below).
 */
// The canvas rect, read at most once per frame: getBoundingClientRect() on every pointermove can
// force a synchronous style/layout pass (the HUD's DOM text changes every second).
let canvasRect = null;
function canvasLogicalPoint(event) {
  const rect = (canvasRect ||= canvas.getBoundingClientRect());
  const clamp = (v, size) => Math.max(0, Math.min(size - 1, WIDE_COORD_MAX, v));
  const fx = clamp(((event.clientX - rect.left) * LOGICAL_W) / rect.width, LOGICAL_W);
  const fy = clamp(((event.clientY - rect.top) * LOGICAL_H) / rect.height, LOGICAL_H);
  return { x: Math.round(fx), y: Math.round(fy), fx, fy };
}

function packTouchWide(id, x, y) {
  return (
    (WIDE_MARKER |
      (((y >> WIDE_COORD_BITS) & 1) << 29) |
      (((x >> WIDE_COORD_BITS) & 1) << 28) |
      ((id & 0xff) << (WIDE_COORD_BITS * 2)) |
      ((y & WIDE_COORD_MASK) << WIDE_COORD_BITS) |
      (x & WIDE_COORD_MASK)) >>>
    0
  );
}

function buildTouchArrays() {
  if (activeContacts.size === 0) return { touches: undefined, hits: undefined, precise: undefined };
  const touches = [];
  const hits = [];
  const precise = [];
  for (const [id, pt] of activeContacts) {
    touches.push(packTouchWide(id & 0xff, pt.x, pt.y));
    pt.seen = true;
    precise.push(pt.fx ?? pt.x, pt.fy ?? pt.y);
    // Hit fact: resolved once, on the frame the contact appears, and carried for its lifetime
    // (docs/TOUCH.md) — not re-queried every virtual frame of a drag.
    if (pt.hit === undefined) {
      const ops = wasm?.ops;
      const hitFn = ops?.hitTestBounds ?? ops?.hitTest;
      pt.hit = hitFn ? hitFn(pt.x, pt.y) : 0;
    }
    hits.push(pt.hit);
  }
  return { touches, hits, precise };
}

/**
 * Finger lifted at `pt`. A contact the guest has already seen at that position is dropped at
 * once, so the up edge (and a fling) lands on the next virtual frame. Latching it for one more
 * frame, as before, cost every fling a quarter of its first display frame of motion (a visible
 * dip at release). The latch stays for a contact the guest has not seen yet (down and up between
 * two frames: a tap) and for a lift that carries new movement.
 */
function releaseContact(id, c, pt) {
  const moved = pt && (pt.fx !== (c.fx ?? c.x) || pt.fy !== (c.fy ?? c.y));
  if (c.seen && !moved) {
    activeContacts.delete(id);
    return;
  }
  if (pt) Object.assign(c, pt);
  c.release = true;
}

function sweepReleasedContacts() {
  for (const [id, pt] of activeContacts) {
    if (pt.release) activeContacts.delete(id);
  }
}
// Virtual clock policy (docs/DETERMINISM.md): virtual frames per second. One
// frame(buttons) transaction + tickHz/simHz core ticks per virtual frame, so
// ms-based animations cover the same VIRTUAL time at every rate. ?hz=2
// runs the 2 FPS world a headless agent sees — on a real screen.
//
// tickHz is the bundle's TICKS_PER_SECOND (build-time --hz=N, default 60).
// The framework publishes it on globalThis.__pocketTickHz after eval; before
// that we assume 60.  simHz is the host loop rate — defaults to tickHz so a
// 120 Hz build runs at 120 FPS on a 120 Hz display without any URL flag.
let tickHz = 60;
let simHz = 60;
let hzRequested = false;

// Simulation rate = display rate. Web builds bake 240 Hz ticks so every display gets at least
// one step per frame, but the loop then ran 4 app transactions (input, effects, every onFrame
// hook, reactivity) per displayed frame at 60 Hz, 3 of them invisible — and their garbage.
// When the display refreshes at a divisor of the tick rate the app runs ONE transaction per
// frame, advancing the core by tickHz / simHz ticks (virtual time is unchanged; the app's
// physics and timers are time-based). Other rates (144, 165 Hz) keep simHz = tickHz and the
// accumulator. A display change (window moved to another screen, Low Power Mode) reloads at
// the new rate, keeping view and scroll like a density change.
const DISPLAY_RATES = [30, 60, 120, 240];
let preferredSimHz; // display rate for the next load: undefined = not probed yet, null = tickHz
let rateMismatch = 0; // consecutive frames the display rate disagreed with simHz
let rateReload = null;

/** The display rate matching a refresh period, if it is one of DISPLAY_RATES (±4 %). */
function displayRate(periodMs) {
  if (!(periodMs > 0)) return null;
  const hz = 1000 / periodMs;
  return DISPLAY_RATES.find((rate) => Math.abs(hz - rate) / rate < 0.04) ?? null;
}

let refreshProbe = null;
/** Median rAF interval over a dozen frames (null when rAF does not run, e.g. a hidden tab). */
function probeRefresh() {
  refreshProbe ||= new Promise((resolve) => {
    const dts = [];
    let prev = 0;
    const step = (t) => {
      if (prev) dts.push(t - prev);
      prev = t;
      if (dts.length >= 12) {
        dts.sort((a, b) => a - b);
        resolve(dts[dts.length >> 1]);
      } else requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    setTimeout(() => resolve(null), 600);
  });
  return refreshProbe;
}
probeRefresh();
let logSink = () => {};
let fpsSink = () => {};
let statsFrames = 0;
let statsT = 0;
let hudFps = 0; // on-canvas HUD, sampled once/second (see hud.js)
let hudMem = 0;
let currentName = null; // demo currently loaded (devtools seek/replay reloads it)

// ---- DevTools device channel (docs/DEVTOOLS.md) ---------------------------------
// This host is a DevTools "device": it connects to the dev server's WS hub
// and injects a transport into the runtime shim (framework/src/devtools.ts) before the
// bundle evals. Host-level messages (seek/replay need a from-boot reload +
// deterministic fast-forward — only the host can do that) are intercepted
// here; everything else is queued for the shim to poll each frame.

let dtWs = null;
let dtInbox = []; // lines waiting for the shim's recv()
let dtOutbox = []; // lines buffered while the WS is (re)connecting
let dtBackoff = 500;

function dtSend(line) {
  if (dtWs && dtWs.readyState === 1) dtWs.send(line);
  else if (dtOutbox.length < 200) dtOutbox.push(line);
}

// Opt-in (?devtools=1): with a transport installed the framework's shim serializes the whole UI
// tree whenever it changes (every frame while scrolling, ~400 KB/s of garbage) and polls stats,
// and tools/serve.ts has no DevTools hub, so it only fed a WebSocket retry loop.
const devtoolsEnabled = query.get("devtools") === "1";

function connectDevtools() {
  let url;
  try {
    url = new URL("/ws?role=device", location.href);
  } catch {
    return; // not served over http (file://) — no devtools
  }
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  try {
    dtWs = new WebSocket(url);
  } catch {
    return;
  }
  dtWs.onopen = () => {
    dtBackoff = 500;
    while (dtOutbox.length) dtWs.send(dtOutbox.shift());
  };
  dtWs.onmessage = (e) => {
    const line = typeof e.data === "string" ? e.data : "";
    let msg = null;
    try {
      msg = JSON.parse(line);
    } catch {
      return;
    }
    if (msg && msg.t === "seek") return void devtoolsSeek(msg.frame);
    if (msg && msg.t === "replay") return void devtoolsReplay(msg.tape);
    if (msg && msg.t === "screenshot") return void devtoolsScreenshot();
    dtInbox.push(line);
  };
  dtWs.onclose = () => {
    dtWs = null;
    setTimeout(connectDevtools, dtBackoff);
    dtBackoff = Math.min(dtBackoff * 2, 8000);
  };
  dtWs.onerror = () => {};
}

/** On-demand screenshot (host-level: the framebuffer lives here). Renders
 *  the current core output clean — no HUD overlay — and ships a PNG data
 *  URL back to the panel. */
function devtoolsScreenshot() {
  if (!wasm) return;
  // Always shoot at the full RENDER_SCALE, not the live FB_W/FB_H (which may be
  // dipped to the motion scale mid-scroll — see blit()).
  const shotW = LOGICAL_W * RENDER_SCALE;
  const shotH = LOGICAL_H * RENDER_SCALE;
  const shot = document.createElement("canvas");
  shot.width = shotW;
  shot.height = shotH;
  const sctx = shot.getContext("2d");
  const img = sctx.createImageData(shotW, shotH);
  img.data.set(wasm.renderScaled(RENDER_SCALE));
  sctx.putImageData(img, 0, 0);
  const frame = globalThis.__pocketDevtools ? globalThis.__pocketDevtools.frame : 0;
  dtSend(JSON.stringify({ t: "screenshot", frame, data: shot.toDataURL("image/png") }));
}

/** Replay from boot: the guest shim expands every recorded input track,
 * including v4 axes. For older tapes it supplies [] to suppress live motion. */
async function devtoolsReplay(tape) {
  if (!currentName || !tape) return;
  await load(currentName, { tape });
}

/** Time-travel seek: reload from boot and deterministically fast-forward
 *  (tick-only, no render) to `frame` using the current session's own
 *  flight-recorder tape, then freeze the world there. */
async function devtoolsSeek(frame) {
  const shim = globalThis.__pocketDevtools;
  if (!currentName || !shim) return;
  const tape = shim.dumpTape();
  if (tape.startFrame > 0) {
    logSink(`seek: recorder wrapped — earliest reachable frame is ${tape.startFrame}`);
  }
  const target = Math.max(0, Math.min(frame | 0, tape.frames));
  await load(currentName, { tape, pauseAt: target });
}

function safeFrame() {
  if (!frameCb) return;
  try {
    // Audio module: fold the audio clock's facts into this tick's event
    // batch BEFORE the guest's single turn (poll() drains them inside it).
    if (audioHost) audioHost.beginFrame();
    if (netHost) netHost.beginFrame();
    // JS: one virtual-frame transaction (input, effects, sweep)
    const t0 = perf ? performance.now() : 0;
    const { touches, hits, precise } = buildTouchArrays();
    // Exact coordinates of this frame's contact words (patched framework/src/touch.ts).
    globalThis.__pocketTouchPrecise = precise;
    frameCb(held, packedAnalog(), touches, hits);
    globalThis.__pocketTouchPrecise = undefined;
    sweepReleasedContacts();
    const t1 = perf ? performance.now() : 0;
    const ticks = tickHz / simHz;
    for (let t = 0; t < ticks; t++) wasm.tick();
    if (perf) {
      perf.add("frame", t1 - t0);
      perf.add("tick", performance.now() - t1);
    }
  } catch (e) {
    logSink("FRAME ERROR: " + (e && e.stack ? e.stack : e));
    frameCb = null; // stop repeating the same throw 60x/s
  }
}

// Reallocate the framebuffer/canvas at an integer scale. Cheap enough to call
// on a motion transition (once per scroll start/stop), not every frame.
/** GPU backing store: the displayed CSS size in exact device pixels. */
function gpuBackingSize() {
  const dpr = window.devicePixelRatio || 1;
  const cssW = displayCss ? displayCss.w : LOGICAL_W;
  const cssH = displayCss ? displayCss.h : LOGICAL_H;
  return { w: Math.max(1, Math.round(cssW * dpr)), h: Math.max(1, Math.round(cssH * dpr)) };
}

function fmtMem(bytes) {
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  return Math.round(bytes / 1024) + " KB";
}

/**
 * The FPS / memory HUD is DOM text over the canvas corners. It used to be drawn into the
 * framebuffer (CPU path) or a second full-screen 2D canvas (GPU path), which Safari resampled
 * — the labels came out blurry on phones. Text elements are rasterized by the browser at the
 * screen's native resolution, and cost nothing per frame.
 */
function createHud() {
  const pill = (align, color) => {
    const el = document.createElement("span");
    Object.assign(el.style, {
      position: "absolute",
      top: "3px",
      [align]: "3px",
      padding: "2px 4px",
      background: "rgba(8, 11, 20, 0.68)",
      color,
      font: "700 11px/12px ui-monospace, SFMono-Regular, Menlo, monospace",
      whiteSpace: "pre",
    });
    return el;
  };
  hudEl = document.createElement("div");
  hudEl.id = "hud";
  hudEl.setAttribute("aria-hidden", "true");
  Object.assign(hudEl.style, { position: "absolute", pointerEvents: "none", zIndex: "1" });
  hudFpsEl = pill("left", "#34d399");
  hudMemEl = pill("right", "#60a5fa");
  hudEl.append(hudFpsEl, hudMemEl);
  canvas.parentElement.style.position ||= "relative";
  canvas.after(hudEl);
  updateHud();
}

function positionHud() {
  if (!hudEl) return;
  Object.assign(hudEl.style, {
    left: `${canvas.offsetLeft}px`,
    top: `${canvas.offsetTop}px`,
    width: canvas.style.width || `${LOGICAL_W}px`,
    height: canvas.style.height || `${LOGICAL_H}px`,
  });
}

function updateHud() {
  if (!hudEl) return;
  hudFpsEl.textContent = "FPS " + (hudFps | 0);
  hudMemEl.textContent = "MEM " + fmtMem(hudMem);
  hudFpsEl.hidden = globalThis.__hudShowFps === false;
  hudMemEl.hidden = globalThis.__hudShowMem === false;
}

function sizeFramebuffer(scale) {
  canvasRect = null;
  if (gpu) {
    const { w, h } = gpuBackingSize();
    FB_W = w;
    FB_H = h;
    fbScale = w / LOGICAL_W;
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    positionHud();
    needsFullRender = true;
    return;
  }
  fbScale = scale;
  FB_W = LOGICAL_W * scale;
  FB_H = LOGICAL_H * scale;
  canvas.width = FB_W;
  canvas.height = FB_H;
  ctx.imageSmoothingEnabled = false;
  needsFullRender = true; // resizing the canvas element clears it — repaint whole
  positionHud();
}

// Choose the motion raster scale from the last painted frame's measured cost:
// drop a step whenever it overran the budget, raise one only when the PREDICTED
// (cost ∝ scale²) cost of the higher scale would still fit with headroom. The
// gap between BUDGET_DROP and BUDGET_RAISE is the hysteresis that keeps it from
// flapping 1↔2 at the boundary.
function adaptMotionScale() {
  if (lastRenderMs <= 0) return;
  const budget = displayIntervalMs;
  if (lastRenderMs > budget * BUDGET_DROP && motionScale > 1) {
    motionScale--;
  } else if (motionScale < RENDER_SCALE) {
    const next = motionScale + 1;
    const predicted = (lastRenderMs * (next * next)) / (fbScale * fbScale);
    if (predicted <= budget * BUDGET_RAISE) motionScale = next;
  }
}

function gpuBlit() {
  const t0 = performance.now();
  // Draws only when the DrawList changed (or after a resize); otherwise the last frame stays.
  const drew = gpu.render(FB_W / LOGICAL_W, needsFullRender);
  needsFullRender = false;
  lastBlitDrew = drew;
  if (perf) {
    perf.add("blit", performance.now() - t0);
    for (const [name, ms] of Object.entries(gpu.timings)) perf.add("blit." + name, ms);
  }
  if (drew) {
    const cost = performance.now() - t0;
    lastRenderMs = lastRenderMs > 0 ? lastRenderMs + RENDER_COST_EMA * (cost - lastRenderMs) : cost;
  }
  hudDirty = false;
}

function blit() {
  if (!wasm) return;
  if (gpu && !gpu.lost) return gpuBlit();
  if (!ctx) return;
  // Motion signal: the DrawList hash. drawHash() doesn't rasterize, so this
  // probe is ~free; the change RATE over MOTION_WINDOW frames drives the scale.
  const hash = wasm.drawHash ? wasm.drawHash() : null;
  if (hash === null) {
    // Older wasm without ui_draw_hash: no motion signal, so paint every frame
    // at full scale and never idle-skip — the safe, un-optimized fallback.
    if (fbScale !== RENDER_SCALE) sizeFramebuffer(RENDER_SCALE);
    const px = needsFullRender ? wasm.renderScaled(fbScale) : wasm.renderScaledIncremental(fbScale);
    needsFullRender = false;
    ctx.putImageData(
      new ImageData(new Uint8ClampedArray(px.buffer, px.byteOffset, px.length), FB_W, FB_H),
      0,
      0,
    );
    hudDirty = false;
    return;
  }
  const drawChanged = hash !== lastDrawHash;
  const changed = drawChanged ? 1 : 0;
  lastDrawHash = hash;
  motionChanges += changed - motionRing[motionRingPos];
  motionRing[motionRingPos] = changed;
  motionRingPos = (motionRingPos + 1) % MOTION_WINDOW;
  const inMotion = motionChanges >= MOTION_ENTER;

  // Target scale: full when fully still (crisp the instant you stop to read),
  // the adaptive motionScale while moving, hold otherwise (hysteresis band).
  let wantScale = fbScale;
  if (motionChanges === 0) {
    wantScale = RENDER_SCALE;
    motionScale = RENDER_SCALE; // re-arm the climb for the next gesture
  } else if (inMotion) {
    wantScale = motionScale;
  }
  if (wantScale !== fbScale) sizeFramebuffer(wantScale);

  // Idle skip: when the DrawList is unchanged, the framebuffer already on the
  // canvas is still correct — don't re-raster or re-upload it. A periodic
  // forced repaint (IDLE_SKIP_CAP) is cheap insurance against a browser that
  // drops the canvas backing store. The HUD is repainted whenever it changes.
  if (!needsFullRender && !drawChanged && !hudDirty && idleSkips < IDLE_SKIP_CAP) {
    idleSkips++;
    return;
  }
  idleSkips = 0;

  const t0 = (typeof performance !== "undefined" ? performance : Date).now();
  // After a live viewport resize (or a scale change above) the incremental
  // damage map no longer matches the framebuffer size — repaint the whole frame
  // once, then resume delta blits.
  const pixels = needsFullRender
    ? wasm.renderScaled(fbScale)
    : wasm.renderScaledIncremental(fbScale);
  needsFullRender = false;
  // Wrap the wasm framebuffer view straight into the ImageData rather than
  // copying it into a persistent buffer first. putImageData still copies once
  // into the canvas backing store, but this drops a second full-frame memcpy
  // every frame (~11 MB on a DPR-2 phone at 400×860) — pure overhead while
  // scrolling. No wasm call runs between taking the view and putImageData, so
  // linear memory can't grow/detach under it.
  ctx.putImageData(
    new ImageData(
      new Uint8ClampedArray(pixels.buffer, pixels.byteOffset, pixels.length),
      FB_W,
      FB_H,
    ),
    0,
    0,
  );
  hudDirty = false;
  // Measure this paint (EMA) and feed the motion controller. Only meaningful
  // while moving — a settled frame renders at full scale by policy regardless.
  const cost = (typeof performance !== "undefined" ? performance : Date).now() - t0;
  lastRenderMs = lastRenderMs > 0 ? lastRenderMs + RENDER_COST_EMA * (cost - lastRenderMs) : cost;
  if (inMotion) adaptMotionScale();
}

/**
 * Simulation steps to run for a display frame that took `dt` ms.
 *
 * Flooring wall time into fixed steps (the classic accumulator) makes motion uneven at a steady
 * refresh: rAF timestamps jitter by a fraction of a millisecond, the accumulator's phase sits
 * near a step boundary, and a 240 Hz clock on a 60 Hz display runs 4, 3, 5, 4 … steps per frame —
 * a scroll moves 25% too little on one frame and 25% too much on the next while the counter
 * still reads 60 fps. When the refresh period is a whole number of steps (60/120/240 Hz displays
 * for a 240 Hz clock) each vsync advances exactly that many; a late frame advances by the vsyncs
 * it spanned. Other rates (144, 165 Hz) keep the accumulator.
 */
function vsyncSteps(dt) {
  const STEP = 1000 / simHz;
  const maxSteps = Math.max(4, Math.round(simHz / 15)); // bounds a post-tab-hide burst
  if (dt > 0) {
    refreshRing[refreshCount++ % REFRESH_SAMPLES] = dt;
    const n = Math.min(refreshCount, REFRESH_SAMPLES);
    refreshSorted.set(refreshRing.subarray(0, n));
    const median = refreshSorted.subarray(0, n).sort()[n >> 1];
    let sum = 0;
    let count = 0;
    for (let i = 0; i < n; i++) {
      if (Math.abs(refreshRing[i] - median) <= median * 0.1) {
        sum += refreshRing[i];
        count++;
      }
    }
    refreshMs = sum / count;
  }
  const perVsync = refreshMs / STEP;
  const whole = Math.round(perVsync);
  if (whole >= 1 && Math.abs(perVsync - whole) < 0.12) {
    acc = 0;
    return Math.min(maxSteps, Math.max(1, Math.round(dt / refreshMs)) * whole);
  }
  acc += dt;
  let steps = 0;
  while (acc >= STEP && steps < maxSteps) {
    acc -= STEP;
    steps++;
  }
  return steps;
}

// Dev diagnostics (hosts/web/perf.js): ?perf=1 frame-time reports, ?autodrag=1 scripted finger.
const perf = createPerf(query.get("perf") === "1", () => ({
  refreshMs,
  trace: query.get("trace") === "1",
  labels: {
    backend: gpu ? "gpu" : "cpu",
    dpr: window.devicePixelRatio || 1,
    viewport: `${LOGICAL_W}x${LOGICAL_H}`,
    simHz,
  },
}));
const autoDrag = createAutoDrag(query.get("autodrag") === "1", () => ({
  w: LOGICAL_W,
  h: LOGICAL_H,
}));
const AUTO_DRAG_ID = 250;
let lastBlitDrew = false;

function applyAutoDrag(now) {
  const contact = autoDrag(now);
  const live = activeContacts.get(AUTO_DRAG_ID);
  if (contact) {
    const pt = { x: Math.round(contact.x), y: Math.round(contact.y), fx: contact.x, fy: contact.y };
    if (live && !live.release) Object.assign(live, pt);
    else activeContacts.set(AUTO_DRAG_ID, { ...pt, release: false });
  } else if (live && !live.release) {
    releaseContact(AUTO_DRAG_ID, live, null);
  }
}

/** Reload at the display's rate when it has disagreed with simHz for ~1.5 s (see DISPLAY_RATES). */
function watchDisplayRate() {
  const rate = displayRate(refreshMs);
  const want = rate !== null && Number.isInteger(tickHz / rate) ? rate : tickHz;
  rateMismatch = want === simHz ? 0 : rateMismatch + 1;
  if (rateMismatch < 90 || rateReload || !currentName) return;
  logSink(`display: ${Math.round(1000 / refreshMs)} Hz -> simulation ${want} Hz`);
  preferredSimHz = want === tickHz ? null : want;
  rateMismatch = 0;
  const name = currentName;
  rateReload = load(name).finally(() => (rateReload = null));
}

function tick(now) {
  rafId = requestAnimationFrame(tick);
  canvasRect = null;
  perf?.begin(now);
  if (autoDrag && frameCb) applyAutoDrag(now);
  // Screen change backstop: the resolution media query does not fire everywhere (emulated
  // ratios, some browsers on monitor moves); comparing the ratio each frame costs nothing.
  if ((window.devicePixelRatio || 1) !== knownDpr) onPixelRatioChange();
  let dt = now - last;
  last = now;
  if (dt > 250) dt = 250; // avoid the catch-up spiral after tab hide
  // Track the panel's IDEAL cadence: snap down to any faster frame (that reveals
  // the true refresh period), creep only slowly toward slower ones so a run of
  // heavy scroll frames can't inflate the budget the scroll is judged against.
  if (dt > 0) {
    if (dt < displayIntervalMs) displayIntervalMs = Math.max(4, dt);
    else displayIntervalMs += 0.01 * (dt - displayIntervalMs);
    if (displayIntervalMs > 34) displayIntervalMs = 34;
  }
  if (!hzRequested && frameCb && refreshCount >= REFRESH_SAMPLES) watchDisplayRate();
  const steps = vsyncSteps(dt);
  for (let i = 0; i < steps; i++) safeFrame();
  lastBlitDrew = false;
  if (steps > 0) {
    blit();
    statsFrames++; // count visual frames (blits), not simulation steps
    if (presentWaiters.length) {
      // The compositor shows this frame on the next vsync; resolve after it.
      const waiters = presentWaiters;
      presentWaiters = [];
      requestAnimationFrame(() => waiters.forEach((resolve) => resolve()));
    }
  }
  perf?.end(now, steps, lastBlitDrew, activeContacts.get(AUTO_DRAG_ID)?.fy);
  statsT += dt;
  if (statsT >= 1000) {
    // Sample FPS + memory once per second for the on-canvas HUD.
    hudFps = Math.round((statsFrames * 1000) / statsT);
    // Console / automation diagnostics: live paint rate (follows the display) and the clock.
    globalThis.__pocketStats = {
      fps: hudFps,
      tickHz,
      simHz,
      backend: gpu ? "gpu" : "cpu",
    };
    hudMem = wasmMemoryBytes(wasm);
    updateHud();
    fpsSink(hudFps);
    statsFrames = 0;
    statsT = 0;
  }
}

/**
 * Resolves once a frame rendered after this call is on screen. The page keeps the canvas
 * hidden until then, so a load shows the app background and then the laid-out app, never
 * an empty (black) WebGL canvas or a placeholder-sized first frame.
 */
export function whenPresented() {
  return new Promise((resolve) => presentWaiters.push(resolve));
}

function start() {
  if (rafId) return;
  last = performance.now();
  acc = 0;
  rafId = requestAnimationFrame(tick);
}

function stop() {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }
}

// ---- input -------------------------------------------------------------------

function onKey(down) {
  return (e) => {
    if (NUBMAP[e.code]) {
      e.preventDefault();
      if (down) nubHeld.add(e.code);
      else nubHeld.delete(e.code);
      return;
    }
    const bit = KEYMAP[e.code];
    if (bit === undefined) return;
    e.preventDefault();
    if (down) held |= bit;
    else held &= ~bit;
  };
}

/** Virtual on-screen buttons ([data-btn] elements). */
export function pressVirtual(bit, down) {
  if (down) held |= bit;
  else held &= ~bit;
}

/** The render scale currently applied: the exact device-pixel ratio on the GPU path. */
export function renderScale() {
  return gpu ? FB_W / LOGICAL_W : RENDER_SCALE;
}

/** Renderer + density in use, for the page's resolution label. */
export function renderInfo() {
  return {
    backend: gpu ? "gpu" : "cpu",
    density: RASTER_DENSITY,
    scale: renderScale(),
    dpr: window.devicePixelRatio || 1,
  };
}

/**
 * The CSS size the page displays the canvas at. On the GPU path the backing store follows it
 * in exact device pixels, so the frame is never resampled (crisp at fractional ratios and when
 * a fixed device resolution is fitted into a smaller window).
 */
export function setDisplaySize(cssW, cssH) {
  displayCss = { w: Math.max(1, cssW), h: Math.max(1, cssH) };
  if (wasm && canvas) sizeFramebuffer(RENDER_SCALE);
}

/** Called after the screen's pixel ratio changes (window moved to another display). */
export function onDisplayChange(listener) {
  displayListeners.add(listener);
  return () => displayListeners.delete(listener);
}

// ---- display tracking ----------------------------------------------------------------
// devicePixelRatio changes when the window moves to another screen (or on browser zoom).
// A new density reloads the app with that density's atlases; the same density only re-sizes.
let dprQuery = null;
let densityReload = null;
let knownDpr = 0;
function watchPixelRatio() {
  knownDpr = window.devicePixelRatio || 1;
  if (typeof matchMedia !== "function") return;
  if (dprQuery) dprQuery.removeEventListener("change", onPixelRatioChange);
  dprQuery = matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
  dprQuery.addEventListener("change", onPixelRatioChange);
}
function onPixelRatioChange() {
  if ((window.devicePixelRatio || 1) === knownDpr) return; // both detectors fired
  watchPixelRatio();
  for (const listener of displayListeners) listener();
  const next = autoDensity();
  if (!densityPinned && currentName && next !== RASTER_DENSITY) {
    logSink(`display: devicePixelRatio ${window.devicePixelRatio} -> density ${next}x`);
    RASTER_DENSITY = next;
    RENDER_SCALE = next;
    const name = currentName;
    densityReload = (densityReload ?? Promise.resolve()).then(() => load(name));
  } else if (wasm && canvas) {
    sizeFramebuffer(RENDER_SCALE);
  }
}

/**
 * Toggle the retina framebuffer live. scale = DPR renders at device-pixel
 * density (crisp); scale = 1 renders at the logical size, so the browser
 * upscales the canvas on a HiDPI panel — the un-adjusted look. Reallocates the
 * framebuffer at logical × scale; the logical viewport and display size are
 * unchanged. Returns the applied scale.
 */
export function setRenderScale(scale) {
  scale = Math.max(1, Math.min(4, Math.round(scale)));
  if (gpu) return RENDER_SCALE; // GPU path always renders at the panel's native resolution
  if (!wasm || !canvas || scale === RENDER_SCALE) return RENDER_SCALE;
  RENDER_SCALE = scale;
  RASTER_DENSITY = scale;
  motionChanges = 0; // treat a manual scale change as settled
  motionRing.fill(0);
  motionScale = RENDER_SCALE; // re-arm the adaptive climb at the new ceiling
  hudDirty = true;
  sizeFramebuffer(RENDER_SCALE);
  return RENDER_SCALE;
}

/** The current logical viewport (CSS-pixel size the app lays out for). */
export function getViewport() {
  return { w: LOGICAL_W, h: LOGICAL_H };
}

/**
 * Resize the live logical viewport WITHOUT a page reload. The app observes
 * ops.__viewport each frame and reflows; the framebuffer is reallocated at
 * logical × RENDER_SCALE so retina crispness is preserved at any size. Returns
 * the new logical size (clamped to sane bounds). No-op if unchanged.
 */
export function setViewport(logicalW, logicalH) {
  const w = Math.max(1, Math.min(16000, Math.round(logicalW)));
  const h = Math.max(1, Math.min(16000, Math.round(logicalH)));
  if (!wasm || !canvas || (w === LOGICAL_W && h === LOGICAL_H)) {
    return { w: LOGICAL_W, h: LOGICAL_H };
  }
  LOGICAL_W = w;
  LOGICAL_H = h;
  wasm.resizeViewport(LOGICAL_W, LOGICAL_H); // updates ops.__viewport + ui_set_viewport
  sizeFramebuffer(RENDER_SCALE); // reallocate the canvas at the full scale
  return { w: LOGICAL_W, h: LOGICAL_H };
}

// ---- lifecycle ------------------------------------------------------------------

/** Bind the host to a canvas + fetch/instantiate the wasm. Call once. */
export async function mount(theCanvas, opts = {}) {
  if (opts.onLog) logSink = opts.onLog;
  if (opts.onFps) fpsSink = opts.onFps;
  canvas = theCanvas;
  canvas.width = FB_W;
  canvas.height = FB_H;
  window.addEventListener("keydown", onKey(true));
  window.addEventListener("keyup", onKey(false));
  window.addEventListener("blur", () => {
    held = 0;
    nubHeld.clear();
    activeContacts.clear();
  });

  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (_) {
      /* CDP/synthetic pointers */
    }
    const pt = canvasLogicalPoint(e);
    activeContacts.set(e.pointerId, { ...pt, release: false });
  });
  canvas.addEventListener("pointermove", (e) => {
    const c = activeContacts.get(e.pointerId);
    if (!c || c.release) return;
    const pt = canvasLogicalPoint(e);
    c.x = pt.x;
    c.y = pt.y;
    c.fx = pt.fx;
    c.fy = pt.fy;
  });
  const pointerEnd = (e) => {
    const c = activeContacts.get(e.pointerId);
    if (!c) return;
    if (e.type === "pointerup") releaseContact(e.pointerId, c, canvasLogicalPoint(e));
    else c.release = true;
  };
  canvas.addEventListener("pointerup", pointerEnd);
  canvas.addEventListener("pointercancel", pointerEnd);
  canvas.style.touchAction = "none";

  // Wheel / trackpad scroll: accumulate delta between frames; the app drains
  // it via globalThis.__wheelDeltaY() inside its onFrame hook.
  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      let dy = e.deltaY;
      if (e.deltaMode === 1) dy *= WHEEL_LINE_PX; // DOM_DELTA_LINE
      else if (e.deltaMode === 2) dy *= LOGICAL_H; // DOM_DELTA_PAGE
      wheelAccumY += dy;
    },
    { passive: false },
  );
  globalThis.__wheelDeltaY = () => {
    const v = wheelAccumY;
    wheelAccumY = 0;
    return v;
  };

  const hzParam = Number(query.get("hz"));
  if (Number.isInteger(hzParam) && hzParam > 0 && hzParam <= 240) {
    simHz = hzParam;
    hzRequested = true;
  }
  // Init at the max cap (see INIT_MAX); load() lays the app out once at that
  // size to raise the grow ceiling, then presents the current logical size.
  wasm = await createWasmUi(await compileWasm(), {
    width: INIT_MAX,
    height: INIT_MAX,
    rasterDensity: RASTER_DENSITY,
  });
  // Backend: WebGL2 unless unavailable or ?gpu=0. The choice must precede any 2D context —
  // a canvas holds one context type for its lifetime.
  if (query.get("gpu") !== "0") {
    try {
      gpu = createGpuRenderer(canvas, wasm);
    } catch (e) {
      logSink("GPU renderer unavailable, using the software rasterizer: " + (e && e.message));
      gpu = null;
    }
  }
  if (!gpu) {
    ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
  }
  // Sub-pixel translates (patched core, engine/web gpu_set_subpixel): the WebGL backend draws
  // fractional translates — scroll offsets — at device-pixel precision; the app then paints its
  // unrounded offset (app/ui/scroller.ts paintOffset). The software rasterizer keeps whole px.
  const subpixel = !!gpu && typeof wasm.exports.gpu_set_subpixel === "function";
  if (subpixel) wasm.exports.gpu_set_subpixel(1);
  globalThis.__pocketSubpixelTranslate = subpixel;
  createHud();
  watchPixelRatio();
  if (devtoolsEnabled) connectDevtools();
  logSink(
    `PocketJS wasm ready (${gpu ? "WebGL2" : "software"} renderer, density ${RASTER_DENSITY}x, ` +
      `devicePixelRatio ${window.devicePixelRatio || 1})`,
  );
}

// ---- shell state bridge (app/store/shell-bridge.ts) ---------------------------------------
// A density change reloads the app; like the iOS shell, keep the user's view + scroll: the
// guest publishes its state over the svc mailbox and the next load replays it.
const SHELL_NAMESPACE = "pocket-home";
let shellState = null;
let shellInbox = [];
function installShellBridge(ops) {
  ops.svcOpen = (namespace) => namespace === SHELL_NAMESPACE;
  ops.svcSend = (line) => {
    try {
      const message = JSON.parse(line);
      if (message && message.t === "pocket-home/state") shellState = message.state ?? null;
    } catch {
      // not ours
    }
  };
  ops.svcPoll = () => (shellInbox.length ? shellInbox.splice(0).join("\n") : null);
}

/** Fetch `<name><ext>` for the current density (dist/density/<d>/), else the default build. */
async function fetchAsset(name, ext) {
  const byDensity = await fetch(`dist/density/${RASTER_DENSITY}/${name}${ext}`);
  if (byDensity.ok) return byDensity;
  return fetch(`dist/${name}${ext}`);
}

// ---- startup downloads -----------------------------------------------------------------
// Opening the page used to fetch wasm → instantiate → pak → bundle one after another. The
// wasm now compiles while it streams in, and preload() starts the app's pak and bundle at the
// same time, so the first frame waits for the slowest download, not the sum of all of them.
let wasmModule = null;
function compileWasm() {
  wasmModule ||= (async () => {
    const res = await fetch("pocketjs.wasm");
    if (!res.ok) throw new Error("pocketjs.wasm not found — run: bun tools/wasm.ts");
    if (WebAssembly.compileStreaming) {
      try {
        return await WebAssembly.compileStreaming(res.clone());
      } catch {
        // wrong MIME type from a static host: compile from bytes
      }
    }
    return WebAssembly.compile(await res.arrayBuffer());
  })();
  return wasmModule;
}

const preloaded = new Map(); // "<name><ext>" -> Promise<ArrayBuffer | string | null>
/** Start downloading the engine and an app's pak + bundle; load() consumes them. */
export function preload(name) {
  compileWasm().catch(() => {}); // mount() reports the error
  for (const [ext, read] of [
    [".pak", (r) => r.arrayBuffer()],
    [".js", (r) => r.text()],
  ]) {
    const key = name + ext;
    if (!preloaded.has(key)) {
      preloaded.set(
        key,
        fetchAsset(name, ext).then((r) => (r.ok ? read(r) : null)),
      );
    }
  }
}
/** One use: a later load() of the same app (a density change) must fetch the new density. */
function takePreloaded(name, ext, read) {
  const key = name + ext;
  const hit = preloaded.get(key);
  preloaded.delete(key);
  return hit || fetchAsset(name, ext).then((r) => (r.ok ? read(r) : null));
}

/**
 * Load (or reload) a demo: fresh core, __pak + globalThis.ui BEFORE eval,
 * fresh function scope per reload, then start the loop. Returns null on
 * success, the error otherwise.
 */
export async function load(name, opts = {}) {
  if (!wasm) throw new Error("mount() first");
  stop();
  frameCb = null;
  wheelAccumY = 0;
  // Reset the core. Normal loads mount at INIT_MAX so the first layout pass
  // raises the grow ceiling (the core can grow the live viewport up to a size
  // it has already laid out at, but not beyond); the target is presented after
  // eval, below. A DevTools replay/seek boots straight at the logical size —
  // it never live-resizes, and mounting at INIT_MAX would offset its
  // deterministic frame count.
  const bootW = opts.tape ? LOGICAL_W : INIT_MAX;
  const bootH = opts.tape ? LOGICAL_H : INIT_MAX;
  wasm.resizeViewport(bootW, bootH);
  wasm.init(RASTER_DENSITY); // fresh Ui: tree/styles/atlases/textures all reset
  // Host contract (see apps/hero/main.tsx): both globals BEFORE eval, reset
  // EVERY load so nothing stale leaks across reloads.
  installShellBridge(wasm.ops);
  shellInbox =
    shellState !== null ? [JSON.stringify({ t: "pocket-home/restore", state: shellState })] : [];
  globalThis.ui = wasm.ops;
  globalThis.frame = undefined;
  // Audio module (contracts/spec/audio.ts): mounted as its own namespace,
  // reset per load like every other contract slot (streams die with the app).
  if (!audioHost) audioHost = createAudioHost();
  audioHost.reset();
  globalThis.audio = audioHost.ns;
  // NET module: browser fetch is transport-only; guest code sees the same
  // bounded globalThis.net contract as native runtimes.
  if (!netHost) netHost = createNetHost();
  netHost.reset();
  globalThis.net = netHost.ns;
  // Clock policy (before eval, like __pak). ?hz=N pins the simulation rate; otherwise the
  // display's rate when it divides the tick rate (see DISPLAY_RATES), else unset so the
  // framework runs at TICKS_PER_SECOND.
  if (!hzRequested && preferredSimHz === undefined && !opts.tape) {
    preferredSimHz = displayRate(await probeRefresh());
  }
  globalThis.__simHz = hzRequested ? simHz : (preferredSimHz ?? undefined);
  rateMismatch = 0;
  // DevTools: identity + transport BEFORE eval; render() picks them up.
  globalThis.__pocketApp = name;
  dtInbox = [];
  globalThis.__pocketDevtoolsTransport = devtoolsEnabled
    ? { send: dtSend, recv: () => (dtInbox.length ? dtInbox.shift() : null) }
    : undefined;
  try {
    const [pak, src] = await Promise.all([
      takePreloaded(name, ".pak", (r) => r.arrayBuffer()),
      takePreloaded(name, ".js", (r) => r.text()),
    ]);
    globalThis.__pak = pak ?? undefined;
    if (src === null)
      throw new Error("dist/" + name + ".js not found — run: bun tools/build.ts " + name);
    // Fresh function scope per reload (top-level vars must not collide).
    new Function(src + "\n//# sourceURL=" + name + ".js")();
    if (typeof globalThis.frame !== "function") {
      throw new Error(
        "bundle did not install globalThis.frame — the demo entry must call render() " +
          "(use the <demo>/main.tsx mounting entry, not the bare component module)",
      );
    }
    frameCb = globalThis.frame;
    // Read the build's tick rate and the normalised simulation rate back from
    // the framework (published by resetClock() during eval).
    tickHz = globalThis.__pocketTickHz ?? 60;
    simHz = globalThis.__pocketSimHz ?? tickHz;
    if (!Number.isInteger(tickHz / simHz)) {
      // Not a divisor of this bundle's tick rate (the framework snaps to one): run at tickHz.
      logSink(`clock: ${simHz} Hz does not divide ${tickHz} Hz ticks`);
    }
    if (globalThis.__pocketTickHz === undefined) {
      logSink(
        "warning: bundle did not publish __pocketTickHz — assuming 60 Hz (the loop then paints " +
          "at most 60 fps and a >60 Hz bundle runs slow); publish TICKS_PER_SECOND after mount",
      );
    }
    logSink(`clock: ${tickHz} Hz ticks, ${simHz} Hz simulation (paints follow the display)`);
    // Sync the CORE step size to the bundle's tick rate BEFORE the first tick.
    // The core defaults to dt=1/60; a >60 Hz build (see --hz) would otherwise
    // run every ui_animate tick_hz/60× fast, because ms→frames uses the core
    // rate. With this, animations stay at wall-clock speed at any build rate.
    if (wasm.setTickRate && !wasm.setTickRate(tickHz)) {
      logSink(`warning: core rejected tick rate ${tickHz} (animations may run at 60 Hz speed)`);
    }
  } catch (e) {
    logSink("LOAD ERROR: " + (e && e.stack ? e.stack : e));
    blit(); // show whatever state the core is in
    return e;
  }
  logSink("loaded " + name);
  currentName = name;
  hudMem = wasmMemoryBytes(wasm); // so MEM shows before the first 1s sample
  updateHud();
  // Raise the grow ceiling: one layout pass at INIT_MAX (the app is mounted at
  // that size), then present the target and let it reflow before the first
  // visible frame, so boot shows the target size — not a flash of INIT_MAX.
  // Skipped for replay/seek (booted at the logical size already).
  if (!opts.tape && (LOGICAL_W !== INIT_MAX || LOGICAL_H !== INIT_MAX)) {
    try {
      wasm.renderScaled(1);
    } catch (_) {
      /* cap render is best-effort */
    }
    wasm.resizeViewport(LOGICAL_W, LOGICAL_H);
    needsFullRender = true;
    for (let i = 0; i < 4 && frameCb; i++) {
      safeFrame();
      await Promise.resolve(); // flush the framework's reactive reflow
    }
  }
  if (opts.tape) {
    // Keep one replay cursor in the guest shim. It expands sparse v4 axis
    // deltas together with button/analog/touch input and substitutes [] for
    // every axis-free frame, including tapes written before v4.
    dtInbox.push(JSON.stringify({ t: "replay", tape: opts.tape }));
    if (opts.pauseAt > 0) {
      // Deterministic fast-forward: frame+tick only, no render, yielding to
      // the event loop so a long seek doesn't freeze the tab.
      for (let i = 0; i < opts.pauseAt && frameCb; i++) {
        safeFrame();
        if (i % 1200 === 1199) await new Promise((r) => setTimeout(r, 0));
      }
      dtInbox.push(JSON.stringify({ t: "pause" }));
    }
  }
  safeFrame(); // one immediate frame so the canvas isn't blank
  blit();
  start();
  return null;
}

/** The demo manifest from the dev server (serve.ts /demos endpoint). */
export async function listDemos() {
  const res = await fetch("demos");
  if (!res.ok) return [];
  return await res.json();
}
