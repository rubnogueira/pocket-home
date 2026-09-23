# Pocket Home

Smart-home dashboard built on [PocketJS](https://pocketjs.dev) (Vue Vapor). This repository is **self-contained**: app code, `pocket.json`, and all dev/build tools live here. Only the PocketJS compiler/runtime comes from **`@pocketjs/framework`** (npm).

## Status: proof of concept

**Pocket Home is a PoC and is still under active development.** It is not production-ready.

By default the app runs against **mocked Home Assistant data**: a static snapshot of [demo.home-assistant.io](https://demo.home-assistant.io/) (`app/data/home-assistant-demo-seed.ts`), served in dev via a Bun WebSocket mock (`tools/ha-mock-ws.ts`) or inlined through `EmbeddedDataSource`. Real instance support exists (`HAWebSocketSource` + `app/data/config.ts`) but is optional, incomplete, and not the primary workflow yet.

Work in progress includes a **real HA connection** (auth, reconnect, multi-dashboard, REST/history), **full Lovelace parity**, bug fixes, and polish (fonts, scroll, layout, images, edit/save).

### Direction (planned)

- **UI:** Move toward a proper, polished component layer — [shadcn/ui](https://ui.shadcn.com)-style patterns (accessible primitives, consistent tokens, real charts/dialogs/comboboxes). Today `app/ui/` is a partial port with stubs; the goal is production-quality surfaces, not placeholder rows.
- **Full Lovelace:** Top-level **view tabs**, **subviews** (`subview` / `back_path`), **nested tabs inside a view** (sections **horizontal tab strips** — tab-within-tab navigation like the HA app), **user profiles**, dashboard picker, YAML/storage modes, card editor, badges, features, conditions, themes, and **per-card header/footer** (`picture`, `buttons`, `graph`) — not just rendering a static sections grid behind a custom app chrome.
- **Offline / locked-down networking:** For **old devices** kept on the wall or in a drawer, we want a **strict offline posture**: no general internet access (unpatched OS versions are too risky online). The app should **only** reach your **Home Assistant instance** (LAN/VPN URL you configure) — no arbitrary browsing, no third-party weather/CDN calls unless you explicitly opt in. Demo/mock data remains for dev; production kiosk targets should not phone home elsewhere.
- **Kiosk mode:** Full-screen, single-purpose wall/tablet experience — no accidental escape to the OS browser or settings, optional PIN/admin unlock, always-on dashboard suited to dedicated HA panels.

### Data and Home Assistant connectivity

- **Dev default:** `bun run dev` → same-origin `/api/ws` mock; no live HA required.
- **Real instance:** set `CONFIG.homeAssistant.wsUrl` and `accessToken` in `app/data/config.ts` (long-lived token). Connection failures fall back silently to embedded demo data.
- **No automatic reconnect** after WebSocket drop; no onboarding UI for URL/token.
- **Embedded / mock services** only simulate a subset of domains (lights, switches, climate, covers, locks, media, etc.); many service calls are no-ops.
- **Weather** in the header/sidebar uses Open-Meteo when possible; the weather widget still falls back to placeholder mock data on failure. (Planned **offline-only** builds would drop this and use HA weather entities instead.)
- **Navigation sidebar** is Pocket Home’s own drawer (`DEFAULT_CATEGORIES` in `app/data/config.ts`: `Overview`, `Map`, `Energy`, `Settings`). It is **not** driven by HA’s sidebar (`show_in_sidebar`, dashboard list, panel URLs). Missing or extra HA views, subviews, and admin-only entries will not line up.

### Lovelace parity — not implemented or incomplete

**Custom cards and resources**

- Lovelace `resources` (including **HACS** custom cards) are ignored; unknown card types render as **“Unsupported card”** (`StubCard`).

**Card types not implemented** (registered types are in `app/registry/register-all.ts`; everything else stubs):

- Media / visuals: `picture`, `picture-entity`, `picture-glance`, `picture-elements`, `iframe`, `map`
- History / stats: `statistics-graph` (history-graph is a simplified list, not a chart)
- Rooms / plants / lists: `humidifier`, `plant-status`, `shopping-list`, `toggle-group`, `distribution`
- HA system UI: `empty-state`, `error`, `recovery-mode`, `starting`, `home-summary`, `discovered-devices`, `repairs`, `alert`, `updates`
- **Energy dashboard** cards: `energy-usage-graph`, `energy-distribution`, `energy-sankey`, `energy-date-selection`, `energy-devices-graph`, `energy-devices-detail-graph`, `energy-sources-table`, `energy-solar-graph`, `energy-gas-graph`, `energy-water-graph`, `energy-carbon-consumed-gauge`, `energy-grid-neutrality-gauge`, `energy-grid-balance`, `energy-solar-consumed-gauge`, `energy-self-sufficiency-gauge`, `energy-compare`, `water-sankey`, `water-flow-sankey`, `power-sources-graph`, `power-sankey`
- **Other:** `logbook`

**Badge types not implemented** (only `entity` and `shortcut` are registered): `entity-filter`, `state-label`, `error`, `power-total`, `gas-total`, `water-total`.

**Tile / area card features not implemented** (only a subset in `register-all.ts`; missing types show as grey labels), including: `area-controls`, `bar-gauge`, `button`, `climate-fan-modes`, `climate-swing-modes`, `climate-swing-horizontal-modes`, `climate-preset-modes`, `counter-actions`, `cover-position-favorite`, `cover-tilt`, `cover-tilt-favorite`, `cover-tilt-position`, `date-set`, `fan-direction`, `fan-oscillate`, `fan-preset-modes`, `fan-speed`, `humidifier-modes`, `humidifier-toggle`, `lawn-mower-commands`, `light-color-favorites`, `light-effect`, `lock-open-door`, `media-player-sound-mode`, `media-player-source`, `media-player-volume-buttons`, `precipitation-forecast`, `trend-graph`, `target-humidity`, `temperature-forecast`, `timer-actions`, `timer-presets`, `update-actions`, `vacuum-commands`, `vacuum-fan-speed`, `valve-open-close`, `valve-position-favorite`, `valve-position`, `water-heater-operation-modes`.

**Views and layout**

- **View tabs:** only a simple top row when `views.length > 1` (`DashboardRenderer`); no HA-style tab bar polish, drag-reorder, or visibility rules.
- **Subviews and nested tabs:** `subview` / `back_path` on views are ignored — no drill-in/back stack. **Section horizontal tabs** (switching section groups inside one view, as in HA) are **not implemented**; all sections render in one scrollable column.
- **Header / footer:** Lovelace **card** `header` / `footer` configs (`app/types/header-footer.ts`) are typed but **not rendered** on entities/history-graph/etc. The fixed **app header** (menu, title, clock, edit) is not HA’s configurable view chrome.
- **Sections** view is the best-supported layout; **masonry**, **panel**, and **sidebar** views are basic and lack edit-mode support.
- Section grid row height and scroll **content-height estimation** can drift from real layout (risk of **under-scroll or over-scroll** on long dashboards).
- **Markdown** cards: no full markdown renderer (links stripped to text, limited formatting).
- **Entity pictures** / remote `entity_picture` URLs may not display on all hosts.

**Actions and navigation**

- `url` actions only log to the console (no browser on native).
- `assist`, `fire-dom-event`, and unhandled action types are no-ops.
- Dashboard **edit mode** (reorder cards, section settings) does **not persist** to HA (`saveDashboardConfig` is never called from the UI).

**UI kit stubs** (target is shadcn-quality; not there yet): `Chart`, `Command`, `Combobox`, `InputOTP`, `Resizable`, `Calendar` — see `app/ui/stubs.tsx`.

**Legacy widget grid** (`app/widgets/*`) is largely unused by the main Lovelace shell; do not expect widget-dashboard parity.

### Known bugs and rough edges

- **Fonts / typography:** PocketJS bakes glyph atlases at build time; `font-bold` is used heavily and **weight and sizing may not match** Home Assistant or system UI. Text wrapping uses fixed font slots (`app/ui/wrap-text.ts`) and can mis-measure long strings.
- **Scroll:** kinetic scrolling is manual (main dashboard + sheets + sidebar list); nested scroll areas are incomplete; wheel/DPAD behavior may fight focus or sidebar state.
- **Styling:** Tailwind **opacity modifiers** (e.g. `/20`) are dropped by the compiler — some tints and overlays look wrong (see comment in `app/widgets/Sidebar.tsx`).
- **Settings** UI (`SettingsWidget`) toggles are local-only and not wired to HA or persistent config.
- **iOS / native:** one logical viewport per build; takeover hosts (jailbreak tiers) relayout on rotation and draw with OpenGL ES 2 (`hosts/ios/takeover/README.md`); legacy phone stacks use a smaller override canvas — see [docs/VIEWPORT.md](docs/VIEWPORT.md). The modern iOS app resizes its live surface on rotation / Stage Manager (the relaid-out frame is presented before the rotation animation starts; view, scroll, sheets and edit mode are kept) and lays the surface out in points, so the guest density equals the screen scale and the frame lands 1:1 on device pixels. It draws with Metal (same engine and host view as the jailbreak tiers: `tools/ios-app/pocket-apple-framework.ts`) at the display's full rate (120 Hz on ProMotion).
- **Touch coordinates** carry 11 bits per axis (up to 2047 logical px) through a patch to `@pocketjs/framework` (`patches/`, applied by `bun install`); the 10-bit native cores resolve a wrapped hit for contacts past 1023, so the guest re-queries those.

## Prerequisites

- [Bun](https://bun.sh) (package manager + runs `tools/*.ts` scripts; see `packageManager` in `package.json`)
- Rust + `wasm32-unknown-unknown` for the browser wasm core: `rustup target add wasm32-unknown-unknown`

## Setup

```sh
bun install
```

Workspace packages: root app and `tools/compiler-host` (Bun workspace). The modern iOS app shell under `hosts/ios/app` is a **separate** Bun package (`bun install` there on postinstall) because NativeScript/webpack require a flat `node_modules` tree.

Set **`POCKETJS_FRAMEWORK_ROOT`** to force a specific PocketJS path (overrides npm and parent detection).

## Run in the browser (web)

```sh
bun run dev
```

Open [http://127.0.0.1:8130](http://127.0.0.1:8130). The dev script builds wasm, bundles the app, and serves `dist/` with the mocked Home Assistant WebSocket on the same origin.

Rendering is automatic — no `?scale=`, `?density=` or `?hz=` needed:

- **GPU:** frames are drawn with WebGL2 (`hosts/web/gpu.js`) at the canvas's exact device-pixel size, so every frame is full resolution at the display's refresh rate (60/120/144 Hz…). Without WebGL2 (or with `?gpu=0`) the software rasterizer is used.
- **Density:** glyph atlases and icons are baked at 1×, 2× and 3× (`dist/density/<d>/`); the page loads `ceil(devicePixelRatio)`, so text is sharp on 1×, fractional (125 %, 150 %) and Retina screens.
- **Moving between screens** with different pixel ratios re-renders at the new density and keeps the current view and scroll position.
- **Scrolling** moves at device-pixel precision on the GPU path: a patched core emits the fraction of a scroll offset as a DrawList `OFFSET` scope that `gpu.js` applies snapped to device pixels, and touch coordinates keep their fractional CSS px (`patches/`). The clock advances a fixed number of steps per vsync, so motion per frame is even.

Frame-time diagnostics (any device, including a headless Simulator's Safari): `?perf=1` posts a summary every 2 s to the dev server, printed as `[perf]` lines — rAF interval, dropped frames, main-thread gaps, and the time spent in app transactions, core ticks and each GPU phase. Add `&trace=1` for the scroll offset and finger position per displayed frame, `&autodrag=1` to replay scripted flicks and drags (`hosts/web/perf.js`), and `&gpusync=1` for the time the browser's GPU process takes to execute each frame (a one-pixel read-back; it stalls the pipeline, so measure it separately). `?devtools=1` enables the PocketJS DevTools channel (off by default: its tree snapshots cost a full UI serialization per change).

Per frame the GPU backend issues one or two draw calls: icons share atlas pages, fonts and other textures are bound to texture units named per vertex, and clips are applied on the CPU. The app runs one transaction per displayed frame at 60/120 Hz (it keeps 240 Hz steps on 144/165 Hz displays), so scroll physics are exact functions of time.

## Essential commands

| Command            | Description                                                |
| ------------------ | ---------------------------------------------------------- |
| `bun run build`    | Production web bundle → `dist/`                            |
| `bun run dev`      | Wasm + build + local server (port 8130)                    |
| `bun run check`    | CI gate: manifest, types, lint, format                     |
| `bun test`         | Tests                                                      |
| `bun run ios -- …` | iOS targets (list, doctor, run modern / takeover / legacy) |

Full command reference (modern app, USB auto-route, jailbreak tiers, legacy stacks, format/lint): **[docs/COMMANDS.md](docs/COMMANDS.md)**.

Deploy examples:

```sh
bun run build
bun run ios -- run                              # USB or Simulator (modern app)
bun run ios -- run takeover:arm64-ios12         # Jailbreak tier workflow
```

## Layout

| Path                              | Purpose                                                                       |
| --------------------------------- | ----------------------------------------------------------------------------- |
| `app/`                            | Application (entry, Lovelace, `ui/`, `widgets/`, `data/`, `theme/`, `types/`) |
| `pocket.json`, `pocket.config.ts` | Manifest and compiler defaults                                                |
| `tools/`                          | Build, dev server, wasm, HA icons                                             |
| `hosts/`                          | Browser + iOS hosts — see `hosts/README.md`                                   |
| `dist/`                           | Build output (gitignored)                                                     |

Reload the browser after app changes (`bun run build` or `bun run dev`).
