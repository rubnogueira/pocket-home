# Hosts (commit this folder)

**Yes — commit `hosts/`.** Application source for each runtime. Do **not** commit build output (`dist/`, `.pocket/`, `hosts/**/node_modules/`, `hosts/ios/app/platforms/`).

| Path                 | Purpose                                                      |
| -------------------- | ------------------------------------------------------------ |
| `web/`               | Browser host (`index.html`, `engine.js` loader)              |
| `ios/`               | **All Apple targets** — see [`ios/README.md`](ios/README.md) |
| `ios/app/`           | Modern iOS 16+ NativeScript app (Simulator + USB)            |
| `ios/takeover/`      | Jailbreak UIKit host + tiers                                 |
| `ios/legacy/stacks/` | Legacy stack manifests (iOS 6 and earlier, …)                |
| `ios/catalog/`       | USB product catalog for auto-detect                          |

Run targets: `bun run ios -- list` (`tools/ios-harness.ts`).
