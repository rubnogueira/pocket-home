# Jailbreak device tiers (`hosts/ios/takeover/tiers/`)

| File          | Role                                                         |
| ------------- | ------------------------------------------------------------ |
| `*.tier.json` | Tier metadata (loaded by `tools/ios-native/load-tiers.ts`)   |
| `rust/*.json` | Rust target specs for `pocket-apple` when building that tier |

Parent host template: `hosts/ios/takeover/` (`runtime.m`, `Info.plist`, …). Deploy with `bun tools/ios-native.ts` or `bun run ios -- run takeover:<tier>`.
