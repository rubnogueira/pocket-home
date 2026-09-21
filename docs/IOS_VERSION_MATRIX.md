# iOS / iPadOS version matrix

Pocket Home spans **every era PocketJS can run on**. One `pocket.json` drives the app; each **stack** or **tier** sets the logical viewport and toolchain for that OS generation.

| iOS era             | Example hardware                  | Pocket Home path                          | Build                                                                        |
| ------------------- | --------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------- |
| **3.1.3**           | iPhone 2G (`iPhone1,1`)           | `iphone2g-ios3`                           | `bun run ios:legacy:build-guest iphone2g-ios3` + framework `bun iphone2g …`  |
| **3.x–5.x** (other) | iPhone 3G/3GS, iPad 1             | No PocketJS host in tree                  | —                                                                            |
| **6.0 – 6.1.6**     | iPhone 4S, iPod touch 4/5         | `iphone4s-ios6`, `ipodtouch4-ios6` stacks | `bun run ios:legacy:build-guest iphone4s-ios6` + framework `iphone4s` native |
| **7.x**             | iPhone 4/4s/5, iPad 2–4           | `armv7-ios7` tier                         | `POCKET_IOS_TIER=armv7-ios7 bun run ios:device:build`                        |
| **8.x**             | Same 32-bit fleet                 | `armv7-ios8` tier                         | `POCKET_IOS_TIER=armv7-ios8 bun run ios:device:build`                        |
| **9.x**             | iPad 2, iPhone 4s/5, …            | `armv7-ios9` tier                         | default device tier                                                          |
| **10.x**            | (use 11 or 12 tier if jailbroken) | `arm64-ios11` or `arm64-ios12`            | pick lowest OS your device runs                                              |
| **11.x**            | iPhone 5s–X, iPad Air 2           | `arm64-ios11` tier                        | `POCKET_IOS_TIER=arm64-ios11`                                                |
| **12.x – 15.x**     | Most 64-bit jailbreak devices     | `arm64-ios12` tier                        | `POCKET_IOS_TIER=arm64-ios12`                                                |
| **12.x iPod touch** | iPod touch 6/7                    | `ipodtouch-ios12` stack                   | legacy guest + framework `ipodtouch`                                         |
| **16+**             | Simulator, USB iPhone/iPad        | modern app (`hosts/ios/app`)              | `bun run ios -- run` or `bun tools/ios-app.ts run`                           |
| **Latest iOS**      | Current iPhone/iPad               | same modern app                           | same                                                                         |

### iPhone OS 3.1.3 (first iPhone)

Supported via PocketJS **`iphone2g`** ([hardware table](https://github.com/pocket-stack/pocketjs#hardware-support)). Pocket Home guest: `bun run ios:legacy:build-guest iphone2g-ios3`. Native link/deploy uses framework `tools/iphone2g.ts` (bootstrap, sysroot, ARMv6). See `docs/VIEWPORT.md` for why this stack uses a phone-sized build.

### Other iOS 3–5 releases

No additional PocketJS hosts are published for iPhone 3G/3GS-only lines or iPad 1 in the npm framework package.

### iOS 6 (framework hosts)

Guest builds work from this repo:

```sh
bun run ios:legacy:build-guest iphone4s-ios6
bun run ios:legacy:build-guest ipodtouch4-ios6
```

Native `.app` linking uses **`@pocketjs/framework`** (`hosts/iphone4s`, `tools/iphone4s.ts`): validated iOS 6.1.3 sysroot, Legacy iOS Kit, etc. See framework `docs/IPHONE4S.md`. Pocket Home guest artifacts live under `dist/ios-legacy/<stack>/guest/`; full device images still require the framework link step until external `project-root` is supported upstream.

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
