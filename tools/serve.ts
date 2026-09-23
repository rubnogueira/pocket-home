// Static dev server: browser host from @pocketjs/framework, bundles from `dist/`.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { brotliCompressSync, constants as zlibConstants, gzipSync } from "node:zlib";
import { join } from "node:path";
import { frameworkRoot, PROJECT_ROOT } from "./paths.ts";
import { haMockWebSocket, type HaMockWsData } from "./ha-mock-ws.ts";

const HOST_DIR = join(frameworkRoot(), "hosts/web/");
const LOCAL_HOST_DIR = join(PROJECT_ROOT, "hosts/web/");
const LOCAL_INDEX = join(LOCAL_HOST_DIR, "index.html");
const DIST_DIR = join(PROJECT_ROOT, "dist/");

const MIME: Record<string, string> = {
  html: "text/html; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  json: "application/json",
  webmanifest: "application/manifest+json",
  wasm: "application/wasm",
  png: "image/png",
  pak: "application/octet-stream",
};

// Compressible types. The per-density paks are mostly raw RGBA icons: the 3x pak is 11 MB raw
// and ~0.45 MB as brotli, so compression is most of a phone's first-open time.
const COMPRESSIBLE = new Set(["html", "js", "css", "json", "wasm", "pak", "webmanifest"]);
// Compressed bodies, keyed by path + version (mtime/size), so each build is compressed once.
const compressed = new Map<
  string,
  { version: string; br: Uint8Array<ArrayBuffer>; gzip: Uint8Array<ArrayBuffer> }
>();

function compressedBody(path: string, version: string) {
  const hit = compressed.get(path);
  if (hit && hit.version === version) return hit;
  const raw = readFileSync(path);
  const entry = {
    version,
    br: new Uint8Array(
      brotliCompressSync(raw, {
        params: {
          [zlibConstants.BROTLI_PARAM_QUALITY]: 9,
          [zlibConstants.BROTLI_PARAM_SIZE_HINT]: raw.byteLength,
        },
      }),
    ),
    gzip: new Uint8Array(gzipSync(raw, { level: 6 })),
  };
  compressed.set(path, entry);
  return entry;
}

function fileResponse(path: string, req?: Request): Response {
  if (!existsSync(path)) return new Response("not found", { status: 404 });
  const ext = path.slice(path.lastIndexOf(".") + 1);
  const stat = statSync(path);
  const version = `${stat.mtimeMs.toString(36)}-${stat.size.toString(36)}`;
  const etag = `"${version}"`;
  const headers: Record<string, string> = {
    "content-type": MIME[ext] ?? "application/octet-stream",
    // Revalidate every load (a rebuild shows up at once) but answer unchanged files with 304.
    "cache-control": "no-cache",
    etag,
    vary: "accept-encoding",
  };
  if (req?.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers });
  }
  const accept = req?.headers.get("accept-encoding") ?? "";
  if (COMPRESSIBLE.has(ext) && stat.size > 1024 && /\b(br|gzip)\b/.test(accept)) {
    const body = compressedBody(path, version);
    const br = /\bbr\b/.test(accept);
    headers["content-encoding"] = br ? "br" : "gzip";
    return new Response(br ? body.br : body.gzip, { headers });
  }
  return new Response(Bun.file(path), { headers });
}

/** Compress the current build ahead of the first request (the first open stays fast). */
function warmCompressed(): void {
  const files = [join(LOCAL_HOST_DIR, "pocketjs.wasm"), indexHtml];
  const walk = (dir: string) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(js|pak)$/.test(entry.name)) files.push(full);
    }
  };
  walk(DIST_DIR);
  for (const file of files) {
    if (!existsSync(file)) continue;
    const stat = statSync(file);
    compressedBody(file, `${stat.mtimeMs.toString(36)}-${stat.size.toString(36)}`);
  }
}

function demoManifest(): { name: string; hasPak: boolean; mounts: boolean }[] {
  if (!existsSync(DIST_DIR)) return [];
  return readdirSync(DIST_DIR)
    .filter((f) => f.endsWith(".js"))
    .sort()
    .map((f) => {
      const name = f.slice(0, -3);
      const src = readFileSync(DIST_DIR + f, "utf8");
      return {
        name,
        hasPak: existsSync(DIST_DIR + name + ".pak"),
        mounts: src.includes("installFrameHandler"),
      };
    });
}

const wanted = Number(process.env.PORT ?? 8130);
const indexHtml = existsSync(LOCAL_INDEX) ? LOCAL_INDEX : join(HOST_DIR, "index.html");

const server = Bun.serve<HaMockWsData>({
  hostname: "127.0.0.1",
  port: wanted,
  websocket: haMockWebSocket,
  fetch(req, srv) {
    const url = new URL(req.url);
    const path = url.pathname.replace(/\.\.+/g, "");
    if (path === "/api/ws") {
      if (
        srv.upgrade(req, {
          data: { source: null!, authed: false, ready: false },
        })
      ) {
        return undefined;
      }
      return new Response("WebSocket upgrade expected", { status: 426 });
    }
    if (path === "/__perf" && req.method === "POST") {
      // hosts/web/engine.js ?perf=1: frame-time reports from devices without a console (phones).
      return req.text().then((line) => {
        console.log(`[perf] ${line}`);
        return new Response(null, { status: 204 });
      });
    }
    if (path === "/favicon.ico") {
      return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
    }
    if (path === "/" || path === "/index.html") return fileResponse(indexHtml, req);
    if (path === "/demos") {
      return Response.json(demoManifest(), { headers: { "cache-control": "no-store" } });
    }
    if (path.startsWith("/dist/")) {
      return fileResponse(DIST_DIR + path.slice("/dist/".length), req);
    }
    const rel = path.slice(1);
    const local = join(LOCAL_HOST_DIR, rel);
    if (existsSync(local)) return fileResponse(local, req);
    return fileResponse(join(HOST_DIR, rel), req);
  },
});

console.log(
  `Pocket Home: ${server.url}  (demos: ${
    demoManifest()
      .map((d) => d.name)
      .join(", ") || "none — run bun run build"
  })`,
);
setTimeout(warmCompressed, 0);
