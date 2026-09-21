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
- **Output:** `pocket-home-main` (`pocket.json` → `app.output`).
- **Hz:** `pocket.config.ts` sets `hz: 240` for web hosts.

## Layout

App shell: everything under **`app/`** — entry, Lovelace renderer, `ui/`, `widgets/`, `data/`, `theme/`, `types/`, MDI icons. See the PocketJS monorepo `AGENTS.md` **Pocket Home** sections for widget grid, scroll, HA icons, and edit mode — paths there use `pocket-home/` instead of `apps/pocket-home/`.

## Icons

MDI icons: `app/icons/manifest.json`, `mdi:…` in sources, or `DOMAIN_ICONS`. `bun run icons` or `tools/build.ts` runs `tools/generate-ha-icons.ts`.

## Publishing this repo

Replace `"@pocketjs/framework": "file:.."` in `package.json` with `"^0.12.0"` (or current release), run `bun install`, then `git init` in this folder.
