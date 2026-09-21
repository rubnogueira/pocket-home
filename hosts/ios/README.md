# Apple hosts (`hosts/ios/`)

Everything for running Pocket Home on iPhone/iPad lives under this tree. **`tools/ios/paths.ts`** is the single source of truth for these paths in TypeScript.

| Path                               | Role                                           | Tooling                                                    |
| ---------------------------------- | ---------------------------------------------- | ---------------------------------------------------------- |
| **`app/`**                         | NativeScript shell (iOS 16+, Simulator or USB) | `bun tools/ios-app.ts`, `bun run ios -- run`               |
| **`takeover/`**                    | Jailbreak UIKit `.app` + `tiers/*.tier.json`   | `bun tools/ios-native.ts`, `bun run ios -- run takeover:*` |
| **`legacy/stacks/`**               | Very old devices (iOS 6, …) — stack manifests  | `bun tools/ios-legacy.ts`                                  |
| **`catalog/product-catalog.json`** | USB `ProductType` → label + legacy canvas      | `bun tools/ios-device.ts detect\|ship`                     |

## Commands (repo root)

```sh
bun install
bun run ios -- list
bun run ios -- doctor
bun run ios -- run                    # modern app — USB or Simulator
bun tools/ios-device.ts detect
bun tools/ios-device.ts ship
bun run ios -- run takeover:arm64-ios12
bun run ios -- run iphone4s-ios6
```

See **`app/README.md`** for the modern app in detail, **`docs/IOS_DEVICES.md`** for the full matrix.

## USB auto-route

`tools/ios-device.ts ship` reads **`catalog/product-catalog.json`**, probes USB, then:

- iOS **16+** arm64 → **`app/`** (`tools/ios-app.ts`)
- Jailbreak, older OS → **`takeover/`** tier
- Legacy hardware → **`legacy/stacks/`** guest + framework native tool
