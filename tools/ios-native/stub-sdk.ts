// Link SDK for 32-bit iOS tiers, generated from the installed Xcode's iPhoneOS SDK.
//
// Current Xcode SDKs ship linker stubs (.tbd) for arm64/arm64e only, so an armv7 link fails
// ("missing required architecture armv7 in libSystem.B.tbd") even though clang still compiles
// armv7 code. A stub only tells the linker which dylib (install name) exports which symbol; at
// launch the device binds to its own system libraries. So this mirrors the SDK into
// ~/.cache/pocket-stack/ios-stub-sdk/<sdk-version>-<arch>/, rewriting every .tbd's target list
// to `<arch>-ios` and symlinking everything else (headers, modules, SDKSettings) back to Xcode.
// Xcode itself is only read, never modified.
//
// The stubs list the NEW OS's exports: linking can succeed against a symbol the old OS lacks.
// Clang weak-imports C/ObjC APIs newer than the deployment target (from header availability);
// Rust's std references are covered by hosts/ios/takeover/legacy-shims.c.
import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join, relative } from "node:path";

/**
 * 32-bit ARM ABI exports that 64-bit libraries do not have (so the arm64 stubs never list
 * them), by install name. Present in every armv6/armv7 iOS release.
 */
const ARM32_EXPORTS: Readonly<Record<string, readonly string[]>> = {
  // Struct-returning message sends (CGRect, CGSize...): arm64 returns them in registers.
  "/usr/lib/libobjc.A.dylib": [
    "_objc_msgSend_stret",
    "_objc_msgSendSuper_stret",
    "_objc_msgSendSuper2_stret",
    "_objc_msgSend_stret_debug",
    "_objc_msgSendSuper2_stret_debug",
    "_method_invoke_stret",
  ],
  // armv6/armv7 iOS unwinds with setjmp/longjmp (ObjC @try, C++ exceptions, cleanups).
  "/usr/lib/system/libunwind.dylib": [
    "__Unwind_SjLj_Register",
    "__Unwind_SjLj_Unregister",
    "__Unwind_SjLj_Resume",
    "__Unwind_SjLj_Resume_or_Rethrow",
    "__Unwind_SjLj_RaiseException",
    "__Unwind_SjLj_ForcedUnwind",
  ],
};

/** Rewrites every tbd target list (`[ arm64e-ios, arm64e.x1-ios ]`) to `[ <arch>-ios ]`. */
export function retargetTbd(text: string, arch: string): string {
  const retargeted = text.replace(
    /\[\s*(?:[a-z0-9_.]+-ios(?:-[a-z]+)?\s*,?\s*)+\]/g,
    `[ ${arch}-ios ]`,
  );
  if (!arch.startsWith("armv")) return retargeted;
  // Add the 32-bit-only exports to the document of the library that has them.
  return retargeted
    .split(/(?=^--- !tapi-tbd)/m)
    .map((doc) => {
      const name = /^install-name:\s*'([^']+)'/m.exec(doc)?.[1];
      const extra = name ? ARM32_EXPORTS[name] : undefined;
      if (!extra) return doc;
      const entry = `  - targets:         [ ${arch}-ios ]\n    symbols:         [ ${extra.join(", ")} ]\n`;
      return /^exports:\s*$/m.test(doc)
        ? doc.replace(/^exports:\s*\n/m, (m) => m + entry)
        : doc.replace(/^(\.\.\.\s*)$/m, `exports:\n${entry}$1`);
    })
    .join("");
}

function sdkVersion(sdk: string): string {
  try {
    const settings = JSON.parse(readFileSync(join(sdk, "SDKSettings.json"), "utf8"));
    if (typeof settings.Version === "string") return settings.Version;
  } catch {
    // fall through
  }
  return createHash("sha256").update(sdk).digest("hex").slice(0, 12);
}

/** Every directory on the way to a .tbd (relative to the SDK root), and the .tbd files. */
function tbdLayout(root: string): { dirs: Set<string>; files: string[] } {
  const dirs = new Set<string>([""]);
  const files: string[] = [];
  const walk = (rel: string) => {
    for (const name of readdirSync(join(root, rel))) {
      const path = rel ? `${rel}/${name}` : name;
      const stat = lstatSync(join(root, path));
      if (stat.isDirectory()) walk(path);
      else if (name.endsWith(".tbd")) {
        files.push(path);
        for (let d = dirname(path); d !== "." && !dirs.has(d); d = dirname(d)) dirs.add(d);
      }
    }
  };
  for (const top of ["usr/lib", "System/Library"]) if (existsSync(join(root, top))) walk(top);
  for (const d of ["usr", "System"]) dirs.add(d);
  return { dirs, files };
}

/**
 * Path of an iPhoneOS SDK whose stubs link `arch`, generated once per Xcode SDK version from
 * `xcodeSdk` (the `xcrun --sdk iphoneos --show-sdk-path` result).
 */
export function ensureStubSdk(xcodeSdk: string, arch: string): string {
  const sdk = realpathSync(xcodeSdk);
  const version = sdkVersion(sdk);
  const base = join(homedir(), ".cache/pocket-stack/ios-stub-sdk", `${version}-${arch}`);
  const out = join(base, `iPhoneOS${version}-${arch}.sdk`);
  const stamp = join(base, "stamp.json");
  const want = JSON.stringify({ sdk, version, arch, format: 2 });
  if (existsSync(stamp) && readFileSync(stamp, "utf8") === want && existsSync(out)) return out;

  const staging = `${out}.tmp-${process.pid}`;
  rmSync(staging, { recursive: true, force: true });
  const { dirs, files } = tbdLayout(sdk);
  const tbds = new Set(files);
  const mirror = (rel: string) => {
    const dest = rel ? join(staging, rel) : staging;
    mkdirSync(dest, { recursive: true });
    for (const name of readdirSync(join(sdk, rel))) {
      const path = rel ? `${rel}/${name}` : name;
      if (dirs.has(path) && lstatSync(join(sdk, path)).isDirectory()) mirror(path);
      else if (tbds.has(path)) {
        writeFileSync(
          join(staging, path),
          retargetTbd(readFileSync(join(sdk, path), "utf8"), arch),
        );
      } else {
        // Headers, modules, SDKSettings, binaries: point back at Xcode (relative links would
        // break if the cache moves, so absolute).
        symlinkSync(join(sdk, path), join(staging, path));
      }
    }
  };
  mirror("");
  rmSync(out, { recursive: true, force: true });
  mkdirSync(base, { recursive: true });
  renameSync(staging, out);
  writeFileSync(stamp, want);
  console.log(
    `ios-native: generated ${arch} link SDK (${files.length} stubs) at ${relative(homedir(), out)}`,
  );
  return out;
}
