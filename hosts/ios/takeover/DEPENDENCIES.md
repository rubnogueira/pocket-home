# Jailbreak device build dependencies

These are **system / toolchain** requirements (not npm packages). Install on the Mac that builds and deploys.

| Tool                                 | Purpose                                |
| ------------------------------------ | -------------------------------------- |
| Xcode + `xcrun`                      | iOS SDK, `clang` link                  |
| `rustup`, `cargo`                    | `pocket-apple` static library          |
| Rust **nightly** + `rust-src`        | Only for `armv7-ios9` (`-Z build-std`) |
| `ldid`                               | Sign bare `.app` on jailbreak          |
| `iproxy`, `idevice_id`, `ssh`, `scp` | USB deploy to device                   |
| `bun`                                | Guest compile (`tools/build.ts`)       |

npm dependencies for the app itself are in the **repository root** `package.json` (`@pocketjs/framework`, Vue, compiler-host).
