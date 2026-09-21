# Pocket Home tools

All commands run from the **repository root** (`package.json` scripts call into here).

| Tool                   | Role                                                                                |
| ---------------------- | ----------------------------------------------------------------------------------- |
| `build.ts`             | MDI icon bake, PocketJS app compile, rename to `pocket-home-main`                   |
| `dev.ts`               | `wasm.ts` + `build.ts` + `serve.ts`                                                 |
| `wasm.ts`              | Build `pocketjs.wasm` (Rust → framework `hosts/web`)                                |
| `serve.ts`             | Local static server for the browser host + `dist/` + HA WebSocket mock at `/api/ws` |
| `check.ts`             | Validate `pocket.json` against the `web-app` target                                 |
| `generate-ha-icons.ts` | Rasterize MDI icons (also run from `build.ts`)                                      |

The compiler and browser host assets live in **`@pocketjs/framework`** (`node_modules`). Set `POCKETJS_FRAMEWORK_ROOT` to override that path when developing against a local PocketJS checkout.

When using the npm package (not a monorepo parent checkout), install **`@pocket-home/compiler-host`** (`tools/compiler-host/`) — it pulls in `opentype.js` and the Babel toolchain that `@pocketjs/framework`’s compiler still uses at build time (upstream has not moved to Oxc for JSX yet). App-side lint/format uses **oxlint** and **oxfmt** (`bun run check`); typecheck uses PocketJS **`checkAppTypes`** plus **`tsc --noEmit`** (includes `tests/`). `postinstall` runs **`ensure-framework-deps.ts`** (symlink `vue` / `solid-js` for the compiler) and **`ensure-ios-app-shell.ts`** (Bun install + Ruby gems + `ns` wrapper in `hosts/ios/app`).

| Tool             | Role                                                                     |
| ---------------- | ------------------------------------------------------------------------ |
| `ios-harness.ts` | `bun run ios -- list                                                     | doctor | build-all | run …` |
| `ios-app.ts`     | Modern iOS app — guest build, stage, Simulator or USB (`hosts/ios/app`)  |
| `ios-device.ts`  | USB detect + auto-route (modern app / takeover / legacy)                 |
| `ios-native.ts`  | Jailbreak UIKit `.app` per tier (`hosts/ios/takeover/tiers/*.tier.json`) |
| `ios-legacy.ts`  | Legacy stacks (iOS 6 and earlier, …)                                     |

Device matrix: **`docs/IOS_DEVICES.md`**.
