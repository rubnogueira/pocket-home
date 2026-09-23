//! Copies the installed framework's wasm crate source (engine/wasm/src/lib.rs) into OUT_DIR so
//! src/lib.rs can `include!` it at the crate root. Its inner `#![...]` attributes are lifted
//! out (include! cannot carry them; src/lib.rs re-declares them).
use std::{env, fs, path::PathBuf};

fn main() {
    let manifest = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap());
    let upstream = manifest.join("../../node_modules/@pocketjs/framework/engine/wasm/src/lib.rs");
    println!("cargo:rerun-if-changed={}", upstream.display());
    let source = fs::read_to_string(&upstream)
        .unwrap_or_else(|e| panic!("read {}: {e} (run bun install)", upstream.display()));
    let body: String = source
        .lines()
        .filter(|line| {
            let t = line.trim_start();
            !t.starts_with("#![") && !t.starts_with("//!")
        })
        .map(|line| format!("{line}\n"))
        .collect();
    let out = PathBuf::from(env::var("OUT_DIR").unwrap()).join("upstream_wasm.rs");
    fs::write(out, body).unwrap();
}
