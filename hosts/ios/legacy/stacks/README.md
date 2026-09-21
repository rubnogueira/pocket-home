# Legacy iOS stacks (iOS 6 and framework-only hosts)

These stacks use **PocketJS framework** hosts under `@pocketjs/framework` (`hosts/iphone4s`, `hosts/ipodtouch6`, …). They are not `hosts/ios/takeover` UIKit tiers.

Each `*.stack.json` defines the **logical viewport** Pocket Home must use for that era (override `pocket.json` at build time).

Guest builds: `bun run ios:legacy:build-guest-all`  
Native `.app` (iOS 6): `bun run ios:legacy:native -- iphone4s-ios6` (needs framework sysroot — see `docs/IOS_VERSION_MATRIX.md`).
