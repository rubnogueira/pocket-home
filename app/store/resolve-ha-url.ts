/**
 * Where the web app should connect for Home Assistant data.
 *
 * - Dev (`bun run dev`): same-origin `/api/ws` mock (see tools/ha-mock-ws.ts).
 * - Real instance: set `CONFIG.homeAssistant.wsUrl` in data/config.ts.
 * - Native / offline: returns null → EmbeddedDataSource only (no WebSocket attempt).
 */

import { CONFIG } from "../data/config.ts";

export function resolveHaWebSocketUrl(): string | null {
  const configured = CONFIG.homeAssistant.wsUrl.trim();
  if (configured) return configured;

  if (CONFIG.homeAssistant.accessToken.trim()) {
    return "ws://127.0.0.1:8123/api/websocket";
  }

  const loc = (globalThis as { location?: { host?: string; protocol?: string } }).location;
  if (!loc?.host) return null;

  const proto = loc.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${loc.host}/api/ws`;
}

/** `ws://host:8123/api/ws` → `http://host:8123` for HAWebSocketSource. */
export function haHttpBaseFromWebSocketUrl(wsUrl: string): string {
  const u = new URL(wsUrl.replace(/^ws/, "http"));
  u.pathname = "";
  u.search = "";
  u.hash = "";
  return u.toString().replace(/\/$/, "");
}
