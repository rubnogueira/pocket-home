# Jailbreak device build dependencies

These are **system / toolchain** requirements (not npm packages). Install on the Mac that builds and deploys.

| Tool                                  | Purpose                                                                                                         |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Xcode + `xcrun`                       | iOS SDK headers, `clang`, `ld` (32-bit tiers link against a stub SDK generated from it — Xcode is not modified) |
| `rustup`, `cargo`                     | `pocket-apple` static library                                                                                   |
| Rust **nightly** + `rust-src`         | armv7 tiers (`-Z build-std=std,panic_abort`)                                                                    |
| `rustup target add aarch64-apple-ios` | arm64 tiers (stable toolchain); the modern app's framework also needs `aarch64-apple-ios-sim`                   |
| `ldid` (optional)                     | Sign bare `.app` on jailbreak (else ad-hoc `codesign`)                                                          |
| OpenSSH on the device                 | Deploy over USB (`iproxy` → port 22, root key login)                                                            |
| `iproxy`, `idevice_id`, `ssh`, `scp`  | USB deploy to device                                                                                            |
| `bun`                                 | Guest compile (`tools/build.ts`)                                                                                |

npm dependencies for the app itself are in the **repository root** `package.json` (`@pocketjs/framework`, Vue, compiler-host).
