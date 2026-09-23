# Modern iOS app shell

NativeScript host for **iOS 16+** — **same app** on Xcode Simulator and on a USB iPhone/iPad.

## Commands (from repo root)

```sh
# One-time / after pull
bun install

# Health check (Xcode, simulators, NativeScript shell, Ruby xcodeproj)
bun tools/ios-app.ts doctor
# or
bun run ios -- doctor

# List arm64 simulators (iOS 16+)
bun tools/ios-app.ts devices

# Build guest only (staged into dist/ios-app/guest)
bun tools/ios-app.ts build

# Build guest, stage shell, launch (USB if plugged in, else Simulator)
bun run ios -- run

# Pick a simulator
bun run ios -- run ios -- --simulator="iPad Pro"
bun tools/ios-app.ts run --simulator="iPhone 16"

# USB device (Xcode must see the device)
bun tools/ios-app.ts run --physical --udid=<UDID>

# Reuse last guest build
bun tools/ios-app.ts run --no-build

# Stage + prepare platform without launching
bun tools/ios-app.ts run --no-launch
```

From **`hosts/ios/app`** (NativeScript only — still uses wrapped `ns` after `bun install` at root):

```sh
cd hosts/ios/app
bunx ns prepare ios
bunx ns run ios --device <simulator-udid>
```

Guest assets live under `hosts/ios/app/src/assets/pocket/` (written by `tools/ios-app.ts`).

## What comes from PocketJS (do not duplicate here)

| Upstream                                                                                                                | Role                                                                                                                                                                     |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`engine/ios/build-xcframework.sh`](https://github.com/pocket-stack/pocketjs/blob/main/engine/ios/build-xcframework.sh) | Builds `PocketApple.xcframework` (device + simulator arm64). **Not run in this repo** — consume via npm.                                                                 |
| `@nativescript/pocketjs`                                                                                                | Prebuilt xcframework + `PocketHostView` / `PocketView` plugin.                                                                                                           |
| `@pocketjs/framework/tools/ios-profile.ts`                                                                              | **`ios-dev` / hostAbi 7** contract identity (re-exported in `tools/ios-app/constants.ts`).                                                                               |
| `@pocketjs/framework/tools/ios.ts`                                                                                      | Reference implementation for guest build, staging layout, simulator play. Pocket Home uses the same staging shape (`tools/ios-app/stage-guest.ts`) and `tools/build.ts`. |
| `@pocketjs/framework/hosts/ios-nativescript`                                                                            | Minimal demo shell (fixed 480×272, optional `PocketView`). **Not copied wholesale** — see below.                                                                         |

Rebuild the native surface only when hacking PocketJS itself:

```sh
# In a PocketJS checkout:
pocket ios native [--force]
```

## What Pocket Home adds (keep in this repo)

| Piece                                                            | Why it stays here                                                                                                                           |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **`tools/ios-app.ts`**                                           | Builds guest from **`pocket.json`**, USB + Simulator launch, Bun shell install, Xcode patches.                                              |
| **`tools/ios-app/profile.ts`**                                   | Same **`ios-dev`** target as framework, but logical viewport from manifest + **admissible tablet/phone sizes** (`admissible-viewports.ts`). |
| **`tools/ios-app/simulators.ts`**                                | Fork of framework simulator listing with **iPad** devices and iPad-first auto-pick.                                                         |
| **`NativeScriptApp.swift`**                                      | SwiftUI root that ignores the safe area and boots the runtime from a run-loop block (see "Sizing and rotation").                            |
| **`src/app.ts` + `ios-pocket-host.ts` + `ios-viewport.ts`**      | Full-screen dashboard: one surface on the safe-area panel, resized live (inside the layout pass) on every window size change.               |
| **`ios-embedded-present-fix.ts` + `PocketEmbedPresenter.swift`** | NativeScript 9 SwiftUI embed path; window chrome; frees replaced surfaces.                                                                  |
| **`PocketSurfaceView+PocketHome.m`**                             | Shell glue for `PocketSurfaceView` (Pocket Home's build): chrome colour, `[pocket-perf]` logging, teardown, self-test driver.               |
| **`tools/pocket-ns.cjs`, `webpack.config.js` shim**              | Bundler + Ruby + TS 5.9 webpack shim for `ns prepare` / `ns run`.                                                                           |

## Other iOS paths (not this shell)

| Path                          | Framework reuse                                                                                            |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **`hosts/ios/takeover`**      | Same engine (`engine/ios-takeover`) and host view as this app, per jailbreak tier (`tools/ios-native.ts`). |
| **`hosts/ios/legacy/stacks`** | Per-era stacks + framework hosts (`iphone4s`, …).                                                          |
| **`hosts/web`**               | Browser wasm host — separate from Apple toolchain.                                                         |

See also **`docs/COMMANDS.md`** and **`docs/IOS_DEVICES.md`**.

## Sizing and rotation

- **Guest variant.** `tools/ios-app.ts` stages density 2/3 × 60/120 Hz guests (`current.json` → `variants`); each mount picks one (`pickGuestVariant`): the density equal to the screen scale (2× iPads, 3× iPhones), at the highest rate the display supports whose full repaint fits the raster budget — a lower rate before a lower density, since a density below the screen scale is stretched (soft text that shimmers while scrolling).
- **Surface size.** The surface fills the window minus its safe area. Its logical viewport is that
  panel in points (11" iPad: 834×1158 portrait / 1210×804 landscape), so the framebuffer lands 1:1
  on device pixels. Touch carries 11 bits per axis (bits 28/29 of the wide form, decoded by the
  patched `framework/src/touch.ts`); only a panel past 2047 would be scaled. See `src/ios-viewport.ts`.
- **Rotation / Stage Manager.** The app links Pocket Home's `PocketApple.xcframework`
  (`tools/ios-app/pocket-apple-framework.ts`, installed over the plugin's prebuilt by
  `tools/ios-app.ts run`): `engine/ios-takeover` and the takeover host view. On a window size
  change the shell frames the one surface to the new panel and resizes its live guest inside the
  same layout pass; the guest relayouts (~3–7 ms of JS) and the frame is presented at the new size
  before UIKit's rotation animation starts. No second surface, no stretched frame; the dashboard
  keeps its view and scroll position. The surface's frame is pinned by the shell
  (`PocketHomeSurface.layoutNativeView`): NativeScript ignored size changes made during its
  layout pass and put the previous frame back.
- **Main queue.** `NativeScriptEmbedder.boot()` never returns (the runtime runs a nested run loop).
  Upstream's `NativeScriptMainWindow` starts it from `DispatchQueue.main.async`, which leaves the
  serial main queue blocked for the app's lifetime: every `dispatch_async` to main is dropped,
  including UIKit's own rotation work, so the window froze at its first rotated size.
  `NativeScriptApp.swift` boots from `RunLoop.main.perform` instead.

## Performance and diagnostics

- Frames are drawn with Metal from the core's DrawList (`hosts/ios/takeover/PocketRenderer.m` +
  `PocketMetalBackend.m`, shaders precompiled into the framework), not rasterized on the CPU: a
  scrolling 3x iPhone frame costs ~0.5 ms of render CPU in the Simulator, so the guest runs at the
  display's full rate (120 Hz on ProMotion). `SIMCTL_CHILD_POCKET_HOME_RENDERER=gles` draws with
  OpenGL ES instead (A/B; the Simulator's OpenGL ES is not accelerated).
- `[pocket-perf]` lines (every 120 frames) split each tick into guest frame / render / present time,
  with the draw calls, quads and resource-sync cost:

  ```sh
  xcrun simctl spawn booted log show --last 1m --style compact \
    --predicate 'eventMessage CONTAINS "pocket-perf"'
  ```

- `SIMCTL_CHILD_POCKET_HOME_SELFTEST="<delay>:<action>[:args];…"` drives synthetic input in a
  headless Simulator — `tap:nx,ny`, `drag:nx,fromY,toY`, `rotate:portrait|landscape|landscapeLeft|upsideDown`,
  `mark:text` (coordinates normalised to the surface).
- `tools/ios-app/rotation-stress.sh` — rotation check against the booted Simulator (exits non-zero on
  a stuck window, a surface error, a remount or a surface not laid out 1:1 after the last rotation).

## Launch

- Launch screen, SwiftUI root, NativeScript container, window and surface all use the app colour
  (`#0f172a`), so launch is one continuous colour until the dashboard draws (the unpainted
  SwiftUI/NativeScript root used to flash black in between).
- `tools/ios-app.ts run` mirrors `App_Resources/iOS` (launch screen, asset catalog, build.xcconfig,
  Info.plist keys) into `platforms/ios` on every run; `ns prepare` — the only thing that copied them —
  is skipped once the platform exists.
- In a Simulator with accessibility enabled (`AccessibilityEnabled` in `com.apple.Accessibility`),
  UIKit loads its accessibility bundles on the main thread before the first frame, which holds the
  launch screen ~2–4 s longer. Not an app cost; a device without accessibility clients skips it.
