# iOS / iPadOS version matrix

Pocket Home spans **every era PocketJS can run on**. One `pocket.json` drives the app; each **stack** or **tier** sets the logical viewport and toolchain for that OS generation.

Every iOS release from 5 to the current one gets the same app and the same host behaviour: the
guest lays out at the screen's size in points and relayouts live on rotation (no stretched frame,
no remount), text is drawn at the screen's density, and frames are drawn on the GPU (Metal on
arm64, OpenGL ES 2 on 32-bit). One engine (`engine/ios-takeover`) and one host view
(`hosts/ios/takeover/PocketSurfaceView.m` + `PocketRenderer.m`) serve the jailbreak tiers and the
modern app alike.

| iOS                 | Example hardware                                       | Pocket Home path                                  | Renderer    | Build                                                                               |
| ------------------- | ------------------------------------------------------ | ------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------- |
| **3.1.3**           | iPhone 2G (`iPhone1,1`)                                | `iphone2g-ios3` legacy stack (framework host)     | CPU         | `bun run ios:legacy:build-guest iphone2g-ios3` + framework `bun iphone2g …`         |
| **3.x–4.x** (other) | iPhone 3G, iPod touch 1/2 (ARMv6)                      | none — current linkers cannot produce ARMv6       | —           | —                                                                                   |
| **5.x**             | iPad 1, iPhone 3GS/4/4S, iPod touch 3/4, iPad 2        | `armv7-ios5` tier                                 | OpenGL ES 2 | `bun tools/ios-device.ts ship` or `bun tools/ios-native.ts --tier=armv7-ios5 build` |
| **6.x**             | iPhone 3GS/4/4S/5, iPad 2–4, iPad mini, iPod touch 4/5 | `armv7-ios6` tier                                 | OpenGL ES 2 | same, `--tier=armv7-ios6`                                                           |
| **7.x**             | iPhone 4–5s, iPad 2–Air, iPad mini 1/2                 | `armv7-ios7` tier (32-bit also on 64-bit devices) | OpenGL ES 2 | `--tier=armv7-ios7`                                                                 |
| **8.x**             | iPhone 4S–6 Plus, iPad 2–Air 2                         | `armv7-ios8` tier                                 | OpenGL ES 2 | `--tier=armv7-ios8`                                                                 |
| **9.x – 10.x**      | iPad 2, iPhone 4S/5/5c, 64-bit devices up to iPhone 7  | `armv7-ios9` tier                                 | OpenGL ES 2 | default device tier                                                                 |
| **11.x**            | iPhone 5s–X, iPad Air 2                                | `arm64-ios11` tier                                | Metal       | `--tier=arm64-ios11`                                                                |
| **12.x – 16.x**     | 64-bit jailbreaks, iPod touch 6/7 (rootless: iOS 15+)  | `arm64-ios12` tier                                | Metal       | `--tier=arm64-ios12`                                                                |
| **16+** (stock)     | Simulator, current iPhone/iPad over USB                | modern app (`hosts/ios/app`)                      | Metal       | `bun run ios -- run` or `bun tools/ios-app.ts run`                                  |

`bun tools/ios-device.ts ship` picks the path for a USB device (`tools/ios/resolve-deploy-target.ts`):
iOS 7–10 on 64-bit hardware use the 32-bit tier of that release (those releases still run 32-bit
apps); every ARMv7 device can update to iOS 5, the oldest tier. Deploy installs into
`/var/jb/Applications` on rootless jailbreaks (Dopamine, palera1n rootless).

Each tier bundles the guest at the densities its devices have (`rasterDensities`: 1x and 2x on the
32-bit tiers, 2x and 3x on arm64) and loads the one matching the screen, so a 1x iPad 2 and a 2x
iPhone 4S on the same tier both draw text 1:1.

### iPhone OS 3.1.3 (first iPhone)

Supported via PocketJS **`iphone2g`** ([hardware table](https://github.com/pocket-stack/pocketjs#hardware-support)). Pocket Home guest: `bun run ios:legacy:build-guest iphone2g-ios3`. Native link/deploy uses framework `tools/iphone2g.ts` (bootstrap, sysroot, ARMv6). See `docs/VIEWPORT.md` for why this stack uses a phone-sized build.

### iOS 5 and older ARMv7 devices

The `armv7-ios5` tier covers iPad 1 (whose last release is 5.1.1) and every other ARMv7 device on
iOS 5. Before iOS 6 there is no `LC_MAIN`: the executable's entry point came from `crt1.3.1.o`,
which Xcode no longer ships, so `hosts/ios/takeover/legacy-start.S` provides it. iOS 5 asks
`shouldAutorotateToInterfaceOrientation:` for rotation (runtime.m answers it), and the host avoids
APIs newer than iOS 5 (no object subscripting: `setObject:forKeyedSubscript:` is iOS 6).

### iOS 6 phone stacks (framework hosts)

`ship` sends iOS 6 phones and iPods to the `armv7-ios6` tier like every other iOS 6 device. The
framework-host stacks (`iphone4s-ios6`, `ipodtouch4-ios6`) still build for reference
(`bun run ios:legacy:build-guest <stack>`, native link in `@pocketjs/framework` `tools/iphone4s.ts`),
and `bun tools/ios-legacy.ts native <stack>` builds their `nativeTier` instead.

### 32-bit tiers without an old Xcode (iOS 5–10, armv7)

Current Xcode compiles armv7 but its SDK has arm64-only linker stubs. The build generates an
armv7 link SDK from it once (`tools/ios-native/stub-sdk.ts` → `~/.cache/pocket-stack/ios-stub-sdk/`;
Xcode is only read) and links with a flat namespace, so each import binds to whichever system
library exports it on the device's release. Below iOS 10, `hosts/ios/takeover/legacy-shims.c`
supplies `clock_gettime` / `CCRandomGenerateBytes` for Rust's std and QuickJS. `POCKET_IOS_SDK`
still overrides the SDK; `ldid` is optional (ad-hoc `codesign` otherwise).

iPhone OS 3/4 on ARMv6 is not reachable this way: Xcode's linker no longer links armv6 (and
`ld-classic` is gone), and the takeover engine needs Rust's std. The 32-bit Rust specs target
Cortex-A8 (iPhone 3GS/4, iPod touch 3/4, iPad 1) on the iOS 5–7 tiers: LLVM's Cortex-A9 model
emits half-precision conversions the A8 lacks.

### Jailbreak tiers (`hosts/ios/takeover/tiers/`)

Each `*.tier.json` is one **minimum iOS + CPU** line. Set `app.viewport.fixed.logical` in `pocket.json` for phone vs tablet layout.

```sh
bun run ios:device:list
bun run ios:device:build:all
```

### Simulator (current iOS)

Xcode arm64 simulator or USB (iOS 16+): `bun run ios -- run`.

### Build everything that compiles in this repo

```sh
bun run ios:build:all
```

Runs web, simulator guest, **all** `ios-native` tiers, and **all** legacy stack guests.
