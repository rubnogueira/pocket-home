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
import { drawHud, wasmMemoryBytes } from "./hud.js";
import { createAudioHost } from "./audio.js";
import { createNetHost } from "./net.js";

const query = new URLSearchParams(location.search);
function positiveIntParam(name, fallback, max = 32000) {
  const value = Number(query.get(name));
  return Number.isInteger(value) && value > 0 && value <= max ? value : fallback;
}

// Render scale = device-pixel ratio, but the AUTO default is capped at 2.
// The logical viewport is a CSS-pixel size (what the app lays out for); the
// framebuffer is rendered at logical × scale so retina panels stay crisp.
// This host rasterizes in software and blits the whole framebuffer every
// frame, so per-frame cost grows as scale² — on a DPR-3 phone, scale 3 is
// 2.25× the pixel work of scale 2 while scrolling, for no gain past retina
// (and it also exceeds the density-2 font atlas that `bun run dev` bakes, so
// text is BOTH slower and softer). Scale 2 is the crispness ceiling most eyes
// resolve; the Settings dropdown and ?scale=N still allow up to 4× for a
// static high-DPI screenshot. ui_render_scaled() accepts 1..4.
const MAX_AUTO_RENDER_SCALE = 2;
function defaultRenderScale() {
  return Math.max(1, Math.min(MAX_AUTO_RENDER_SCALE, Math.round(window.devicePixelRatio || 1)));
}

// LOGICAL_* and FB_* are mutable: setViewport() re-sizes the live viewport
// without a page reload (see hosts/web/index.html). RENDER_SCALE stays fixed
// for the session — it is baked into the raster density at ui_init().
let LOGICAL_W = positiveIntParam("width", DEFAULT_FB_W);
let LOGICAL_H = positiveIntParam("height", DEFAULT_FB_H);
// RENDER_SCALE is mutable: setRenderScale() toggles the retina framebuffer
// on/off live (the HiDPI checkbox). RASTER_DENSITY tracks it for AA sampling.
let RENDER_SCALE = positiveIntParam("scale", defaultRenderScale(), 4);
let RASTER_DENSITY = positiveIntParam("density", RENDER_SCALE, 255);
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
let ctx = null;
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
// frame() as packed wide-format integers (bit31=1, x:10, y:10, id:8).
//
// Latching: a contact that appears and disappears between frames is held for
// one frame so the gesture layer sees a down edge.  A "pending release"
// contact is delivered once more and then removed after the frame consumes it.
const activeContacts = new Map(); // pointerId -> {x, y, release}
const WIDE_MARKER = 0x80000000;
const WIDE_COORD_BITS = 10;
const WIDE_COORD_MASK = (1 << WIDE_COORD_BITS) - 1;

function canvasLogicalPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: Math.max(
      0,
      Math.min(LOGICAL_W - 1, Math.round(((event.clientX - rect.left) * LOGICAL_W) / rect.width)),
    ),
    y: Math.max(
      0,
      Math.min(LOGICAL_H - 1, Math.round(((event.clientY - rect.top) * LOGICAL_H) / rect.height)),
    ),
  };
}

function packTouchWide(id, x, y) {
  return (
    (WIDE_MARKER |
      ((id & 0xff) << (WIDE_COORD_BITS * 2)) |
      ((y & WIDE_COORD_MASK) << WIDE_COORD_BITS) |
      (x & WIDE_COORD_MASK)) >>>
    0
  );
}

function buildTouchArrays() {
  if (activeContacts.size === 0) return { touches: undefined, hits: undefined };
  const touches = [];
  const hits = [];
  for (const [id, pt] of activeContacts) {
    touches.push(packTouchWide(id & 0xff, pt.x, pt.y));
    const ops = wasm?.ops;
    const hitFn = ops?.hitTestBounds ?? ops?.hitTest;
    const hit = hitFn ? hitFn(pt.x, pt.y) : 0;
    hits.push(hit);
  }
  return { touches, hits };
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
    const { touches, hits } = buildTouchArrays();
    frameCb(held, packedAnalog(), touches, hits);
    sweepReleasedContacts();
    const ticks = tickHz / simHz;
    for (let t = 0; t < ticks; t++) wasm.tick();
  } catch (e) {
    logSink("FRAME ERROR: " + (e && e.stack ? e.stack : e));
    frameCb = null; // stop repeating the same throw 60x/s
  }
}

// Reallocate the framebuffer/canvas at an integer scale. Cheap enough to call
// on a motion transition (once per scroll start/stop), not every frame.
function sizeFramebuffer(scale) {
  fbScale = scale;
  FB_W = LOGICAL_W * scale;
  FB_H = LOGICAL_H * scale;
  canvas.width = FB_W;
  canvas.height = FB_H;
  ctx.imageSmoothingEnabled = false;
  needsFullRender = true; // resizing the canvas element clears it — repaint whole
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

function blit() {
  if (!wasm || !ctx) return;
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
    drawHud(ctx, FB_W, FB_H, hudFps, hudMem, fbScale);
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
  drawHud(ctx, FB_W, FB_H, hudFps, hudMem, fbScale);
  hudDirty = false;
  // Measure this paint (EMA) and feed the motion controller. Only meaningful
  // while moving — a settled frame renders at full scale by policy regardless.
  const cost = (typeof performance !== "undefined" ? performance : Date).now() - t0;
  lastRenderMs = lastRenderMs > 0 ? lastRenderMs + RENDER_COST_EMA * (cost - lastRenderMs) : cost;
  if (inMotion) adaptMotionScale();
}

function tick(now) {
  rafId = requestAnimationFrame(tick);
  let dt = now - last;
  last = now;
  if (dt > 250) dt = 250; // avoid the catch-up spiral after tab hide
  acc += dt;
  // Track the panel's IDEAL cadence: snap down to any faster frame (that reveals
  // the true refresh period), creep only slowly toward slower ones so a run of
  // heavy scroll frames can't inflate the budget the scroll is judged against.
  if (dt > 0) {
    if (dt < displayIntervalMs) displayIntervalMs = Math.max(4, dt);
    else displayIntervalMs += 0.01 * (dt - displayIntervalMs);
    if (displayIntervalMs > 34) displayIntervalMs = 34;
  }
  const STEP = 1000 / simHz;
  // One blit per rAF, so the VISUAL rate follows the display (60/120/240 Hz)
  // with no hard-coded cap; `steps` sim frames run per rAF to keep virtual time
  // (STEP ms each). The cap bounds a post-tab-hide burst but must scale with
  // simHz — at 240 Hz a 60 Hz display legitimately needs 4 steps/rAF — so keep
  // ~66 ms of catch-up headroom (safeFrame is ~0.001 ms; the blit is the cost).
  const maxSteps = Math.max(4, Math.round(simHz / 15));
  let steps = 0;
  while (acc >= STEP && steps < maxSteps) {
    safeFrame();
    acc -= STEP;
    steps++;
  }
  if (steps > 0) {
    blit();
    statsFrames++; // count visual frames (blits), not simulation steps
  }
  statsT += dt;
  if (statsT >= 1000) {
    // Sample FPS + memory once per second for the on-canvas HUD.
    hudFps = Math.round((statsFrames * 1000) / statsT);
    hudMem = wasmMemoryBytes(wasm);
    hudDirty = true; // the HUD text changed — force one repaint even if idle
    fpsSink(hudFps);
    statsFrames = 0;
    statsT = 0;
  }
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

/** The render scale (device-pixel ratio) currently applied. */
export function renderScale() {
  return RENDER_SCALE;
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
  ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
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
  });
  const pointerEnd = (e) => {
    const c = activeContacts.get(e.pointerId);
    if (c) c.release = true;
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
  const res = await fetch("pocketjs.wasm");
  if (!res.ok) throw new Error("pocketjs.wasm not found — run: bun tools/wasm.ts");
  // Init at the max cap (see INIT_MAX); load() lays the app out once at that
  // size to raise the grow ceiling, then presents the current logical size.
  wasm = await createWasmUi(await res.arrayBuffer(), {
    width: INIT_MAX,
    height: INIT_MAX,
    rasterDensity: RASTER_DENSITY,
  });
  connectDevtools();
  logSink("PocketJS wasm ready");
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
  // Clock policy (before eval, like __pak). When the user passed ?hz=N, push
  // that as the simulation rate; otherwise leave it unset so the framework
  // defaults to TICKS_PER_SECOND — a 120 Hz build auto-runs at 120 FPS.
  globalThis.__simHz = hzRequested ? simHz : undefined;
  // DevTools: identity + transport BEFORE eval; render() picks them up.
  globalThis.__pocketApp = name;
  dtInbox = [];
  globalThis.__pocketDevtoolsTransport = {
    send: dtSend,
    recv: () => (dtInbox.length ? dtInbox.shift() : null),
  };
  try {
    const pak = await fetch("dist/" + name + ".pak");
    globalThis.__pak = pak.ok ? await pak.arrayBuffer() : undefined;
    const srcRes = await fetch("dist/" + name + ".js");
    if (!srcRes.ok)
      throw new Error("dist/" + name + ".js not found — run: bun tools/build.ts " + name);
    const src = await srcRes.text();
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
