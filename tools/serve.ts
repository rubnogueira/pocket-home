// Static dev server: browser host from @pocketjs/framework, bundles from `dist/`.
import { existsSync, readFileSync, readdirSync } from "node:fs";
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
  wasm: "application/wasm",
  png: "image/png",
  pak: "application/octet-stream",
};

function fileResponse(path: string): Response {
  if (!existsSync(path)) return new Response("not found", { status: 404 });
  const ext = path.slice(path.lastIndexOf(".") + 1);
  return new Response(Bun.file(path), {
    headers: {
      "content-type": MIME[ext] ?? "application/octet-stream",
      "cache-control": "no-store",
    },
  });
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
    if (path === "/favicon.ico") {
      return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
    }
    if (path === "/" || path === "/index.html") return fileResponse(indexHtml);
    if (path === "/demos") {
      return Response.json(demoManifest(), { headers: { "cache-control": "no-store" } });
    }
    if (path.startsWith("/dist/")) {
      return fileResponse(DIST_DIR + path.slice("/dist/".length));
    }
    const rel = path.slice(1);
    const local = join(LOCAL_HOST_DIR, rel);
    if (existsSync(local)) return fileResponse(local);
    return fileResponse(join(HOST_DIR, rel));
  },
});

console.log(
  `Pocket Home: ${server.url}  (demos: ${
    demoManifest()
      .map((d) => d.name)
      .join(", ") || "none — run bun run build"
  })`,
);
