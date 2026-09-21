# Commands

`package.json` keeps only scripts needed day to day. Everything else is invoked with **Bun** against `tools/*.ts`.

## Bun scripts (essentials)

| Script          | Purpose                                                                   |
| --------------- | ------------------------------------------------------------------------- |
| `bun install`   | Workspace deps + `postinstall` (framework symlinks, modern iOS app shell) |
| `bun run build` | Compile app → `dist/pocket-home-main.vue-vapor.js` + `.pak`               |
| `bun run dev`   | Wasm + build + dev server → http://127.0.0.1:8130                         |
| `bun run check` | Manifest, app entry typecheck, oxlint, oxfmt, `tsc` (app + tools)         |
| `bun test`      | Unit tests in `tests/`                                                    |
| `bun run ios`   | iOS harness — pass subcommands after `--` (see below)                     |

## Quality / assets (direct)

| Command                                        | Purpose                                                               |
| ---------------------------------------------- | --------------------------------------------------------------------- |
| `bunx oxfmt --write .`                         | Format                                                                |
| `bunx oxlint app tools tests pocket.config.ts` | Lint                                                                  |
| `bun tools/generate-ha-icons.ts`               | MDI PNGs + `app/icons/generated/registry.ts` (also runs from `build`) |
| `bun tools/wasm.ts`                            | Rebuild `pocketjs.wasm`                                               |
| `bun tools/serve.ts`                           | Static server after a build                                           |

## iOS harness (`bun run ios -- …`)

```sh
bun run ios -- list
bun run ios -- doctor
bun run ios -- build-all
bun run ios -- run web
bun run ios -- run ios                    # modern app — USB if connected, else Simulator
bun run ios -- run ios -- --device="iPhone 16"
bun run ios -- run takeover:arm64-ios12
bun run ios -- run iphone4s-ios6
```

(`simulator` is an alias for `ios`.)

## Modern iOS app (`hosts/ios/app`)

Same NativeScript shell on **Simulator and USB** (iOS 16+).

```sh
bun tools/ios-app.ts doctor
bun tools/ios-app.ts devices
bun tools/ios-app.ts build
bun tools/ios-app.ts run
bun tools/ios-app.ts run --simulator=<udid>
bun tools/ios-app.ts run --physical --udid=<udid>
# flags: --hz=60|120|240 --density=1..4 --no-build
```

## Jailbreak device tiers

```sh
bun tools/ios-native.ts list
bun tools/ios-native.ts doctor
POCKET_IOS_TIER=arm64-ios12 bun tools/ios-native.ts build
POCKET_IOS_TIER=arm64-ios12 bun tools/ios-native.ts build-all
POCKET_IOS_TIER=arm64-ios12 bun tools/ios-native.ts launch
bun tools/ios-device.ts detect
bun tools/ios-device.ts ship
```

## Legacy stacks (iOS 3–9)

```sh
bun tools/ios-legacy.ts list
bun tools/ios-legacy.ts build-guest <stack-id>
bun tools/ios-legacy.ts build-guest-all
bun tools/ios-legacy.ts native <stack-id>
```

See **[IOS_DEVICES.md](./IOS_DEVICES.md)** for hardware matrix and tier names.
