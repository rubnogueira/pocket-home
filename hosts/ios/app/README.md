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
| **`src/app.ts` + `ios-pocket-host.ts`**                          | Full-screen dashboard: device logical size, rotation remount, external guest (`PocketHostView`).                                            |
| **`ios-embedded-present-fix.ts` + `PocketEmbedPresenter.swift`** | NativeScript 9 SwiftUI embed path (not in framework demo shell).                                                                            |
| **`ios-safe-area.ts` → `app/`**                                  | Status bar / safe-area insets for Lovelace header.                                                                                          |
| **`PocketSurfaceView+PocketHome.m`**                             | Theme + contents gravity on framework `PocketSurfaceView` (could move upstream later).                                                      |
| **`tools/pocket-ns.cjs`, `webpack.config.js` shim**              | Bundler + Ruby + TS 5.9 webpack shim for `ns prepare` / `ns run`.                                                                           |

## Other iOS paths (not this shell)

| Path                          | Framework reuse                                                                            |
| ----------------------------- | ------------------------------------------------------------------------------------------ |
| **`hosts/ios/takeover`**      | Links `engine/ios/uikit` + `pocket-apple` from framework checkout (`tools/ios-native.ts`). |
| **`hosts/ios/legacy/stacks`** | Per-era stacks + framework hosts (`iphone4s`, …).                                          |
| **`hosts/web`**               | Browser wasm host — separate from Apple toolchain.                                         |

See also **`docs/COMMANDS.md`** and **`docs/IOS_DEVICES.md`**.
