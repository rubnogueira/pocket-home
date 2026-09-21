# iOS jailbreak takeover host

**Commit this directory.** Jailbroken **iPhone and iPad** builds use **tiers** (CPU + minimum iOS), not a specific model. Tier files: `tiers/*.tier.json` (see `tiers/README.md`). System tools: `DEPENDENCIES.md`. Full matrix: `docs/IOS_DEVICES.md`.

## Choose a tier

```sh
bun tools/ios-native.ts list
# or: bun run ios -- list
```

| Tier          | When to use                        |
| ------------- | ---------------------------------- |
| `armv7-ios7`  | **32-bit**, iOS **7.x** jailbreak  |
| `armv7-ios8`  | **32-bit**, iOS **8.x** jailbreak  |
| `armv7-ios9`  | **32-bit**, iOS **9+** jailbreak   |
| `arm64-ios11` | **64-bit**, iOS **11.x** jailbreak |
| `arm64-ios12` | **64-bit**, iOS **12+** jailbreak  |

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

## iOS 6 and older

| Need                                    | Where                                                                  |
| --------------------------------------- | ---------------------------------------------------------------------- |
| **iOS 6.1.x** (iPhone 4S, iPod touch 4) | `hosts/ios/legacy/stacks/` — `bun tools/ios-legacy.ts build-guest-all` |
| **iOS 3–5**                             | Not supported by PocketJS — see `docs/IOS_VERSION_MATRIX.md`           |
| **Modern iOS** (16+, Simulator or USB)  | `bun run ios -- run`                                                   |

Add a jailbreak tier: new `hosts/ios/takeover/tiers/<id>.tier.json` (+ `rust/` spec if needed).
