# iOS jailbreak takeover host

**Commit this directory.** Jailbroken **iPhone and iPad** builds use **tiers** (CPU + minimum iOS), not a specific model. Tier files: `tiers/*.tier.json` (see `tiers/README.md`). System tools: `DEPENDENCIES.md`. Full matrix: `docs/IOS_DEVICES.md`.

## Choose a tier

```sh
bun tools/ios-native.ts list
# or: bun run ios -- list
```

| Tier          | When to use                                      |
| ------------- | ------------------------------------------------ |
| `armv7-ios5`  | **32-bit**, iOS **5.x** jailbreak                |
| `armv7-ios6`  | **32-bit**, iOS **6.x** jailbreak                |
| `armv7-ios7`  | **32-bit**, iOS **7.x** jailbreak                |
| `armv7-ios8`  | **32-bit**, iOS **8.x** jailbreak                |
| `armv7-ios9`  | **32-bit**, iOS **9–10** jailbreak               |
| `arm64-ios11` | **64-bit**, iOS **11.x** jailbreak               |
| `arm64-ios12` | **64-bit**, iOS **12+** jailbreak (rootless too) |

**Screen size** is not tied to the tier — one canvas in `pocket.json` for all takeover tiers. See `docs/VIEWPORT.md`.

## Build & deploy

```sh
bun tools/ios-native.ts doctor --tier=armv7-ios9
POCKET_IOS_TIER=arm64-ios12 bun tools/ios-native.ts build
bun tools/ios-native.ts build-all
POCKET_IOS_TIER=armv7-ios9 bun tools/ios-native.ts deploy
POCKET_IOS_TIER=armv7-ios9 bun tools/ios-native.ts launch

# USB auto-route (detect tier from device):
bun tools/ios-device.ts ship
# or harness:
bun run ios -- run takeover:arm64-ios12
```

Output: `dist/ios-native/<tier>/PocketHome.app`

## Rendering, rotation and diagnostics

- **GPU:** frames are drawn on the GPU (`PocketRenderer.m`, a port of `hosts/web/gpu.js`) from the DrawList of `engine/ios-takeover` (`pocket_apple_gpu_*`), through Metal on arm64 (`PocketMetalBackend.m`, shaders precompiled from `PocketRenderer.metal`) or OpenGL ES 2 (`PocketGLBackend.m`, every tier). On an iPad 2 the software rasterizer needed ~10 ms (up to ~40 ms) per full-screen scroll frame, ~20–40 fps; the GPU path holds 60 fps with ~3 ms of CPU for the DrawList and batches. Glyphs, linear-filtered sprites and a white texel share one atlas page, icons another, so each fragment is one texture read (SGX GPUs are fill-rate bound: three reads per fragment cost ~10 % of the frame rate). The software rasterizer remains the fallback when neither API is available.
- **Density:** the app bundles the guest per density of the tier's devices (`<app>@<d>x.js/.pak`, tier `rasterDensities`) and loads the one matching the screen scale.
- **Rotation:** the guest relayouts to the view's size in points on every layout pass (`PocketViewController` → `-[PocketSurfaceView setLogicalWidth:logicalHeight:]`), and that call runs one guest frame and presents it at the new size before returning, so the rotation animation starts from the new layout (the GL layer never scales a frame: `contentsGravity` center). On an iPad 2 the relayout takes ~65 ms; it took ~1.9 s when the dashboard rebuilt its cards on every width change (see the note in `app/views/SectionsView.tsx`), during which the old frame showed stretched.
- **Status:** `/private/var/tmp/pocketjs-ios-native.status.json` has `logical_now` and `timings` (per 120 frames: guest `frame_ms`, `render_ms` (DrawList + batches, or CPU raster), `present_ms`, display `interval_ms`, `max_tick_ms`, `backend` (`metal`, `gles2` or `cpu`), `draws`, `quads`) and `resize_trace` (the ticks after the last viewport change: ms since the change, frame, render, present, drawn).
- **Markers** (create on the device, relaunch the app): `/private/var/tmp/pocket-autodrag` replays a flick up/down every 3 s (scroll measurements without a finger); `/private/var/tmp/pocket-cpu-raster` forces the software rasterizer and `/private/var/tmp/pocket-renderer-gles` OpenGL ES instead of Metal (A/B); `/private/var/tmp/pocket-rotate` rotates between landscape and portrait every 5 s.

## iOS 6 and older

| Need                                    | Where                                                                  |
| --------------------------------------- | ---------------------------------------------------------------------- |
| **iOS 6.1.x** (iPhone 4S, iPod touch 4) | `hosts/ios/legacy/stacks/` — `bun tools/ios-legacy.ts build-guest-all` |
| **iOS 3–5**                             | Not supported by PocketJS — see `docs/IOS_VERSION_MATRIX.md`           |
| **Modern iOS** (16+, Simulator or USB)  | `bun run ios -- run`                                                   |

Add a jailbreak tier: new `hosts/ios/takeover/tiers/<id>.tier.json` (+ `rust/` spec if needed).
