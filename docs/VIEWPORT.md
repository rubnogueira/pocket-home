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

Modern `hosts/ios/takeover` builds pass your manifest logical size into the guest at compile time. The UIKit host sizes the surface to the panel; the guest layout is always your declared canvas.

### Modern NativeScript app (`bun run ios -- run`)

The **`hosts/ios/app`** shell publishes **`display.viewport.live`**: on each launch and rotation it remounts the Pocket surface at the **key window logical size in DIPs** (not `UIScreen.bounds`), calls `stop()` on the native surface before remount, coalesces rotation callbacks, and recreates the pocket-apple core at the new logical size. Sidecar guests cannot live-resize in-process; remount is required for widget grid reflow.

`pocket.json` `app.viewport.fixed.logical` remains the **build-time design reference** (web dev, jailbreak tiers). It is **not** the runtime resolution on the iOS app shell.

## Why this is not infinite scaling (yet)

PocketJS **bakes glyph atlases at build time** for that logical size. Targets with `display.viewport.live` (browser, macOS window) can resize at runtime; **iOS takeover hosts** today do not expose that capability. So:

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
