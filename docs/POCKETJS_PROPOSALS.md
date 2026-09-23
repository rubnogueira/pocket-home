# Proposed PocketJS / NativeScript changes

Pocket Home works around each item below in this repo. They belong upstream: every PocketJS app
on the same hosts hits them. Numbers were measured on Apple silicon (headless Chrome for web,
iOS 27 Simulator for iOS) unless noted.

## Frame rate and smoothness

### 1. One app transaction per display frame (clock / host loop)

**Today.** The virtual clock runs `TICKS_PER_SECOND / simulationHz` core ticks per virtual
frame, and each virtual frame is one full app transaction (`globalThis.frame`: input, effects,
reactivity, every `onFrame` hook). Web builds bake 240 Hz so any refresh rate gets at least one
step per display frame, which means a 60 Hz screen runs 4 app transactions per displayed frame
and a 120 Hz screen runs 2. The duplicates see identical input and are pure overhead, and they
break anything that reasons in frames (see 2).

**Proposal.** Decouple the transaction rate from the tick rate: let the host pass the elapsed
tick count to `frame(buttons, analog, touches, hits, ticks)` and run ONE transaction per
display frame that advances the clock by `ticks` (timers, `after`, animations and kinetics
already count ticks, so determinism is kept — a replay tape records `ticks` per frame). The
host picks `ticks` from the display interval (rAF / CADisplayLink duration), so any refresh
rate (60/90/120/144/165) is served without baking `--hz` per build or per device.

Pocket Home's web host gets most of this today without a framework change: it measures the
refresh rate before the bundle evaluates and sets `__simHz` to it when it divides the tick rate
(60/120 on a 240 Hz build), reloading on a display change (`hosts/web/engine.js`). That required
making frame-counted app code time-based: the scroller's chase pump, `bindDpadScroll`'s
per-frame step (`app/ui/scroller.ts` `dpadScrollOptions`), uptime from `virtualFrame()`, and the
fling/edge-spring integration (Euler steps at 60 Hz overshot the edge by 2x; both are now
closed-form in `dt`). Upstream `kinetics-core.ts` and `bindDpadScroll` need the same.

### 2. Release velocity from real sample times (`framework/src/gesture-core.ts`)

**Today.** `vx/vy` = position change over the last `VELOCITY_WINDOW = 3` virtual frames × hz.
Touch positions only change once per display frame, so at 240 virtual frames/s the latest
movement is divided by 12.5 ms instead of the 8–17 ms that actually elapsed: release
velocity is inflated up to 2× (or 0 when the last input lands outside the window). Flings
overshoot and hit the edge spring.

**Proposal.** Record a sample only when the contact moved, with its virtual time, and fit
velocity over a time window (~100 ms); report 0 when the finger was still for > ~50 ms before
lifting; clamp to a max fling speed. Fit a quadratic and differentiate it at the lift (Android
`LSQ2`): a straight line reports the speed mid-window, so an accelerating flick released 25–45 %
slower than the finger was moving and the content visibly braked as the finger left.
Pocket Home: `app/ui/scroll-physics.ts` (`fitVelocity`), tests in `tests/scroll-physics.test.ts`.

Hosts should also drop a lifted contact at once when the guest has already seen it at that
position; latching it for one more frame (needed only for a tap that goes down and up between two
frames) costs every fling part of its first frame of motion (`hosts/web/engine.js`
`releaseContact`).

### 3. Scroller physics (`framework/src/kinetics-core.ts`)

- `extent` defaults to `SCREEN_H` (272 px, the PSP screen), so every app that does not pass it
  rubber-bands on a PSP-sized curve. Default it to the live viewport (`ui.__viewport.h`).
- A fling entering the edge carries its full velocity into an uncapped spring: 45 px overshoot
  at 3000 px/s, 141 px at 6000 px/s. Run the overshoot in drag space through the same
  `rubber()` curve used while dragging, absorb part of the entry speed, and use a critically
  damped spring — Pocket Home: 10 px at 3000 px/s, 26 px at 6000 px/s, rest in ~0.4 s.
- Do not bounce when the content fits (`max() == 0`), as `UIScrollView` does by default.
- Settle on whole pixels (not 1/64) so resting text is grid-aligned.
- Sub-pixel translates. `draw.rs` rounds every box and every glyph origin to the pixel grid
  independently (`xy_word`, `emit_text`), and glyph origins carry fractional line-height offsets,
  so a fractional `translateY` made text step a pixel against its card from frame to frame while
  scrolling, and motion moved in whole logical px (3 device px at 3×: fling tails and slow drags
  stepped visibly). Pocket Home patches the core (`patches/`): with `draw::set_subpixel_translate`
  on, a translate-only node paints its subtree at the whole-px part of its translate and wraps it
  in a new `OFFSET dx dy … OFFSET_POP` scope carrying the fraction; the WebGL backend applies it
  snapped to device pixels (scissors re-intersected with their enclosing clip), the software
  rasterizer and damage tracker skip it. Hosts without it round the painted offset
  (`app/ui/scroller.ts` `paintOffset`). Touch needs the same precision: the wire carries whole
  logical px, so Pocket Home's web host publishes exact coordinates beside it
  (`__pocketTouchPrecise`, read by the patched `framework/src/touch.ts`).

### 4. GPU DrawList backend for the browser host (`hosts/web`, `engine/wasm`)

**Today.** The web host rasterizes every frame in wasm (~3 ns per device pixel): a 2× frame of a
900×700 window is ~7 ms and 1440×900 ~15 ms, so full-resolution frames miss a 120 Hz budget and
the host drops to 1× while anything moves (text blurs during scroll).

**Proposal.** Ship the WebGL2 backend upstream: `engine/wasm` exports for the DrawList,
font-atlas coverage and texture pixels (`gpu_draw`, `gpu_font_pack`, `gpu_texture_meta/pack`
in `engine/web/src/lib.rs`), and `hosts/web/gpu.js` (a port of `pocket-ui-wgpu` batching).
Measured: scroll frames p95 1.4 ms / max 4 ms at 2×, zero frames over 8.3 ms, output matching
the software rasterizer except sub-pixel icon edges. The software path stays as the fallback.
WebKit (ANGLE on Metal) creates a texture's GPU copy at its first draw, not at `texImage2D`, so
the first scroll that revealed icons stalled 65–190 ms on iOS Safari: `gpu.js` samples every new
texture once, invisibly, in the frame after upload.

Batch like a GPU UI renderer, not like the DrawList: one draw call per texture/scissor change
issued ~170 draws, binds and scissors per dashboard frame, and Safari serializes every WebGL call
to its GPU process — ~4.4 ms (max 15 ms) of GPU-process time per frame, invisible to page timers
(measured with a one-pixel read-back). `hosts/web/gpu.js` now packs small nearest-filtered images
into atlas pages, binds fonts and the remaining textures to 16 units selected per vertex, clips
quads to the scissor on the CPU, and indexes quads: one draw call per frame, 1/3 fewer vertices,
~1 ms. Resource sync is skipped unless `gpu_resources_version()` (one fingerprint over every font
and texture slot) changed — it scanned 212 slots and allocated per slot on every frame.

The DevTools shim (`framework/src/devtools.ts`) serializes the whole UI tree whenever it is dirty
(every frame while anything scrolls) and polls stats as soon as a transport object exists, even
with no client connected: ~400 KB/s of garbage. Send snapshots only after a client subscribes.

### 5. Build the browser wasm for speed (`engine/wasm/Cargo.toml`, `tools/wasm.ts`)

`opt-level = "s"` → `3`, `codegen-units = 1`, `+simd128,+bulk-memory,+nontrapping-fptoint,
+sign-ext`: ~20–25 % off raster time (2× frame 9.5 → 7.4 ms; 3× 20.6 → 15.7 ms) for +80 KiB.

### 6. GPU rasterization on iOS (`engine/ios`)

The pocket-apple core rasterizes on the CPU (~1.7 ns/px); a full-screen iPad frame at 3× is
~10 ms, so a ProMotion iPad cannot run 120 Hz at native density (Pocket Home runs it at 2×).
A Metal DrawList backend (the same batching as `pocket-ui-wgpu`, or wgpu-on-Metal) removes the
raster from the frame budget. Until then, a damage-aware present API (`pocket_apple_render`
already reports regions) is used by Pocket Home's Metal presenter to upload only changed rects.

## Sizing, density and input

### 7. Live viewport and density on pocket-apple

`pocket_apple_create` fixes the logical size and raster density for the handle's lifetime, so
every rotation / Stage Manager resize / screen change boots a new realm (~150–250 ms plus
~50 MB transient, and app state must be bridged across). Expose `pocket_apple_set_viewport`
(the core already has `Ui::set_viewport`; the web host uses it) and, ideally, a density change
that re-bakes core-owned masks.

### 8. Touch wire wider than 10 bits (`framework/src/touch.ts`, `engine/core/src/touch.rs`)

The wide form carries x/y in 10 bits (max 1023 logical px). Every iPad axis and every desktop
browser window wider than 1023 px exceeds it, and scaling the UI to fit makes the surface
resample on screen (soft, shimmering text). Pocket Home carries the 11th x / y bit in the free
bits 28 / 29 (`patches/@pocketjs%2Fframework@0.12.0.patch`, `PocketSurfaceView+PocketHome.m`,
`hosts/web/engine.js`); the core's `touch::decode` (hit facts) still reads 10 bits, so the guest
drops the fact for such contacts and queries. Upstream: decode bits 28–29 in `touch.rs` too.

### 9. Ship the current PocketSurfaceView in `@nativescript/pocketjs`

The prebuilt 0.2.1 xcframework predates the framework source: it packs touches in the 9-bit
legacy form and clamps coordinates to 511 (most of an iPad screen mis-tapped), and presents by
copying the whole framebuffer into a new CGImage every damaged frame. Pocket Home swizzles both
(`hosts/ios/app/App_Resources/iOS/src/PocketSurfaceView+PocketHome.m`); a rebuilt xcframework
from `engine/ios/uikit` fixes touch for everyone.

### 10. Density-independent text

Glyph atlases are baked per raster density, so a sharp app ships one pak per density
(Pocket Home: 1×/2×/3× web paks of 0.9 / 3.8 / 11 MB, mostly raw RGBA icons). Options: runtime
glyph rasterization on browser hosts (`text.glyphs.runtime` exists for macOS), multi-density
atlases in one pak, and compressed image entries (PNG/ASTC) in the pak.

## NativeScript (SwiftUI boot)

### 11. `NativeScriptMainWindow.swift` starves the main dispatch queue

It boots with `DispatchQueue.main.async { NativeScriptEmbedder.boot() }`; `boot()` never returns
(`runMainApplication` runs a nested `CFRunLoop`), so the main queue stays blocked for the app's
lifetime and every `DispatchQueue.main.async` / `dispatch_after` is dropped — including UIKit's
own post-rotation work (windows froze at their first rotated size). Boot from a run-loop block
(`RunLoop.main.perform`) instead — Pocket Home: `hosts/ios/app/App_Resources/iOS/src/NativeScriptApp.swift`.

## Not fixable in PocketJS

**iOS Safari caps `requestAnimationFrame` at 60 Hz** on ProMotion iPhones/iPads ("Prefer Page
Rendering Updates near 60fps", on by default). Pages cannot opt out; the native iOS app runs at
120 Hz. Android Chrome runs rAF at the panel's refresh (unless battery saver is on).
