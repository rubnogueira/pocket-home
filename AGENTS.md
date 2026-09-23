# Pocket Home — app requirements

Pocket Home is a **standalone** PocketJS application (Vue Vapor). Source, manifest, and build output live in this directory. The compiler and browser host come from **`@pocketjs/framework`** (npm or `file:..` when nested in the PocketJS monorepo).

**Dependencies:** Bun workspace in root `package.json` (`workspaces`) — root app and `tools/compiler-host`. Shared versions in **`workspaces.catalog`**. Install with `bun install` at the repo root (`postinstall` also runs `bun install` in `hosts/ios/app` for the modern iOS NativeScript shell). App scripts run via Bun (`bun run dev`, etc.).

## Commands

| Command         | Purpose                             |
| --------------- | ----------------------------------- |
| `bun run dev`   | `tools/dev.ts` — wasm, build, serve |
| `bun run build` | `tools/build.ts`                    |
| `bun run check` | `tools/check.ts`                    |
| `bun test`      | `tests/`                            |

All tooling lives under **`tools/`** (see `tools/README.md`). The monorepo only invokes `pocket-home/tools/build.ts` when building into the parent `dist/`.

## Stack

- **Framework:** Vue Vapor — import from `vue` and `@pocketjs/framework/*` (not `solid-js`).
- **Entry:** `app/main.tsx` (`pocket.json` → `app.entry`).
- **Lists and resizes:** a JSX `{items.map(...)}` compiles to one effect that re-creates the whole list whenever anything read while mapping changes (no keyed diff). Read only what decides the items there; put viewport/width-dependent numbers in `style={{...}}` (compiled to getters), or a rotation rebuilds the dashboard (see `app/views/SectionsView.tsx`).
- **Output:** `pocket-home-main` (`pocket.json` → `app.output`).
- **Hz / density:** automatic. Web builds bake 240 Hz ticks; the browser host runs one app transaction per displayed frame when the display rate divides it (60/120 Hz: `__simHz`, see `hosts/web/engine.js` `DISPLAY_RATES`), so app code must be time-based, not frame-counted and one bundle + pak per raster density (`dist/density/{1,2,3}/`); `hosts/web/engine.js` picks `ceil(devicePixelRatio)`. iOS stages density 2/3 × 60/120 Hz guests; the shell picks per device (`hosts/ios/app/src/ios-viewport.ts` `pickGuestVariant`).
- **Web renderer:** WebGL2 DrawList backend (`hosts/web/gpu.js`) fed by the Pocket Home wasm (`engine/web`, built by `tools/wasm.ts`); the software rasterizer is the fallback (`?gpu=0`).
- **iOS renderer (jailbreak tiers and the modern app):** native port of it (`hosts/ios/takeover/PocketRenderer.m`) over `engine/ios-takeover`'s `pocket_apple_gpu_*` exports, drawing through Metal on arm64 (`PocketMetalBackend.m`) or OpenGL ES 2 (`PocketGLBackend.m`, 32-bit tiers); one texture fetch per fragment (the SGX GPUs of the 32-bit tiers are fill-rate bound). The modern app links the same engine and host view (`tools/ios-app/pocket-apple-framework.ts` builds PocketApple.xcframework in place of the plugin's prebuilt). Keep the web and iOS renderers in step when the DrawList changes.

## Layout

App shell: everything under **`app/`** — entry, Lovelace renderer, `ui/`, `widgets/`, `data/`, `theme/`, `types/`, MDI icons. See the PocketJS monorepo `AGENTS.md` **Pocket Home** sections for widget grid, scroll, HA icons, and edit mode — paths there use `pocket-home/` instead of `apps/pocket-home/`.

## Icons

MDI icons: `app/icons/manifest.json`, `mdi:…` in sources, or `DOMAIN_ICONS`. `bun run icons` or `tools/build.ts` runs `tools/generate-ha-icons.ts`.

## Publishing this repo

Replace `"@pocketjs/framework": "file:.."` in `package.json` with `"^0.12.0"` (or current release), run `bun install`, then `git init` in this folder.
