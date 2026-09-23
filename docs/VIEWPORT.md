# One viewport, many devices

## What you configure once

`pocket.json` → `app.viewport.fixed.logical` is the **design canvas** (today `1024×768` for the dashboard). That value is used for:

- Web (`bun run dev`)
- Modern iOS app — Simulator or device (`bun run ios -- run`)
- Every **`ios-native` jailbreak tier** (`armv7-ios7` … `arm64-ios12`)

You do **not** pick a different resolution per iPhone or iPad model. Tiers only choose **CPU + minimum iOS** (toolchain), not screen size.

## Why tiers are not “per model”

| Layer                                     | What varies                                |
| ----------------------------------------- | ------------------------------------------ |
| **Tier** (`armv7-ios9`, `arm64-ios12`, …) | Compiler, ABI, minimum OS                  |
| **pocket.json**                           | Logical layout size (one app design)       |
| **Hardware**                              | Physical panel (host fills or letterboxes) |

`hosts/ios/takeover` builds pass your manifest logical size into the guest at compile time as the starting canvas; the UIKit host then relayouts the live guest to the view's size in points (`pocket_apple_set_viewport` in `engine/ios-takeover`, called from `viewDidLayoutSubviews`), so the dashboard follows the device's orientation instead of letterboxing the build canvas. It draws on the GPU (`hosts/ios/takeover/PocketRenderer.m`: Metal on arm64, OpenGL ES 2 on 32-bit) and loads the guest baked for the screen's density.

### Modern NativeScript app (`bun run ios -- run`)

The **`hosts/ios/app`** shell publishes **`display.viewport.live`**: the surface fills the **window's safe-area panel**, and on every window size change (rotation, Stage Manager) the live guest is resized to it inside the layout pass that reports it (`setLogicalWidth:logicalHeight:` → `pocket_apple_set_viewport`), and the relaid-out frame is presented before UIKit's rotation animation starts. One surface lives for the app's lifetime, so the dashboard keeps its view and scroll position. The app links Pocket Home's `PocketApple.xcframework` (`tools/ios-app/pocket-apple-framework.ts`: `engine/ios-takeover` + the takeover host view) in place of the plugin's prebuilt, which could not resize a live surface.

The logical size is the panel in points (e.g. 834×1158 on an 11" iPad in portrait), so one logical px is exactly `screen.scale` device pixels and the guest at that density maps 1:1 onto the panel — a stretched surface is resampled every frame, which blurs text and makes it shimmer while scrolling. Only a panel wider than the touch wire (**2047** per axis, 11 bits with the Pocket Home framework patch) is scaled down. Details: `hosts/ios/app/README.md` → "Sizing and rotation".

`pocket.json` `app.viewport.fixed.logical` remains the **build-time design reference** (web dev, jailbreak tiers). It is **not** the runtime resolution on the iOS app shell.

### Browser (`bun run dev`)

The web host follows the browser window live (`display.viewport.live`). The logical viewport is the page's CSS size; it is rendered with WebGL2 at the canvas's exact device-pixel size (`hosts/web/gpu.js`), and the glyph/icon density is `ceil(devicePixelRatio)` from per-density builds (`dist/density/{1,2,3}/`). A change of pixel ratio (window moved to another screen, browser zoom) re-renders at the new density.

On iPhone Safari (portrait, in the browser) the page is screen-high, so the app is drawn under the translucent floating address bar; the untappable bottom band (bar, home indicator, the page's corner controls) is published as `globalThis.__pocketContentInsets.bottom` and the app extends its scroll range by it, so the last row rests above the bar. The page shows only the app colour until the first laid-out frame is presented (`whenPresented()` in `hosts/web/engine.js`), then fades the app in once the dashboard has its data (`globalThis.__pocketAppReady`).

Startup downloads start in the page head (wasm, and the pak + bundle for the screen's density) and run in parallel. `tools/serve.ts` sends them brotli/gzip-compressed with ETag revalidation: the 3× pak is 11 MB raw and ~0.45 MB compressed. Any other static host must also compress `.pak`, `.js` and `.wasm`.

### Density and tick rate on the iOS app

`tools/ios-app.ts` stages guests for density 2 and 3 × 60 and 120 Hz. At mount the shell picks the highest refresh the screen supports (`UIScreen.maximumFramesPerSecond`) and the smallest density covering the surface's device pixels per logical px (screen scale × surface stretch); frames are drawn with Metal, so no raster budget caps either. `--density` / `--hz` pin a single guest; `SIMCTL_CHILD_POCKET_HOME_DENSITY` / `_HZ` override the pick at launch.

## Why this is not infinite scaling (yet)

PocketJS **bakes glyph atlases at build time** at the build's density. Targets with `display.viewport.live` (browser, macOS window) can resize at runtime, and the iOS takeover host relayouts on rotation; the density is still fixed per build. So:

- You get **one binary per tier**, not one binary per screen size.
- You do **not** need one binary per **model** within a tier.
- Arbitrary “any resolution on any phone” without a new build would need live viewport + runtime glyphs (future host work), or `integer-fit` with integer scale factors (only works for exact multiples).

See [PocketJS hardware support](https://github.com/pocket-stack/pocketjs#hardware-support).

## Legacy stacks (iPhone OS 3 / iOS 6)

The **first iPhone** (iPhone OS 3.1.3) and **iOS 6** hosts in `@pocketjs/framework` (`iphone2g`, `iphone4s`, …) only admit **phone-sized native panels** (e.g. `320×480`). They cannot run the full `1024×768` dashboard as a native-fill surface.

For those stacks only, `hosts/ios/legacy/stacks/*.stack.json` sets `overrideViewportForBuild: true` so the guest is built at the phone canvas. That is an **engine limit**, not a per-model choice.

### First iPhone (iPhone OS 3.1.3)

```sh
bun run ios:legacy:build-guest iphone2g-ios3
# Native .app (USB, bootstrap, sysroot): in @pocketjs/framework checkout:
#   bun iphone2g doctor && bun iphone2g build && deploy/launch
# See framework docs/IPHONE2G.md
```

Receipt: [PocketJS on the first iPhone](https://pocketjs.dev/blog/pocketjs-on-the-first-iphone/).

## Auto-detect on USB deploy

`bun run ios:device:deploy` reads the connected device (`ideviceinfo`), picks **native tier** or **legacy stack**, and:

- **Native** → `pocket.json` canvas + `armv7-*` / `arm64-*` tier
- **Legacy** → per-model canvas from `hosts/ios/catalog/product-catalog.json`

See `hosts/ios/README.md`.
