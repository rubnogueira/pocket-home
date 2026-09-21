# Running Pocket Home on every Apple target

For a **version-by-version table** (iOS 3 through current), see **[IOS_VERSION_MATRIX.md](./IOS_VERSION_MATRIX.md)**.

**Commit `hosts/`** — browser shell, modern iOS app, jailbreak host, legacy stacks. Ignore `dist/`, `.pocket/`, and `hosts/**/node_modules/`.

Full command reference: **[COMMANDS.md](./COMMANDS.md)**.

```sh
bun run ios -- list
```

## 1. Modern browser

```sh
bun run dev
```

## 2. Modern iOS / iPadOS (iOS 16+)

One NativeScript app (`hosts/ios/app/`) — **Simulator or USB device**, same dashboard and live viewport behavior.

**Needs:** Apple Silicon Mac, Xcode, iOS 16+ SDK; `bun install` at repo root (postinstall installs `hosts/ios/app`).

```sh
bun tools/ios-app.ts doctor
bun run ios -- run                              # USB if connected, else Simulator
bun tools/ios-app.ts run --simulator="iPad Pro"
bun tools/ios-app.ts run --physical --udid=<UDID>
```

## 3. Jailbreak UIKit takeover (older hardware / OS)

For devices that **do not** use the modern app path, tiers are **CPU + minimum iOS** (canvas still from `pocket.json`).

```sh
bun run ios -- run takeover              # USB auto tier
bun run ios -- run takeover:arm64-ios12
bun tools/ios-native.ts --tier=armv7-ios9 build
```

See `hosts/ios/takeover/tiers/*.tier.json`.

## 4. Legacy devices (iOS 6 and earlier, …)

Per-model guest canvas from `hosts/ios/catalog/product-catalog.json` — **not** the modern app.

```sh
bun run ios -- run iphone4s-ios6
bun tools/ios-legacy.ts build-guest <stack-id>
```

Stacks: `hosts/ios/legacy/stacks/*.stack.json`.

## 5. Health check

```sh
bun run ios -- doctor
```

Runs web check, modern `ios-app` doctor, jailbreak tier doctors, and lists legacy stacks.
