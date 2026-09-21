/**
 * Home Assistant–compatible WebSocket mock for `bun run dev`.
 * Serves demo seed data so the app never probes ws://localhost:8123 (no console noise).
 */

import type { ServerWebSocket } from "bun";
import { EmbeddedDataSource } from "../app/store/embedded-source.ts";
export type HaMockWsData = { source: EmbeddedDataSource; authed: boolean; ready: boolean };

function send(ws: ServerWebSocket<HaMockWsData>, msg: Record<string, unknown>): void {
  ws.send(JSON.stringify(msg));
}

async function handleRequest(
  ws: ServerWebSocket<HaMockWsData>,
  msg: Record<string, unknown>,
): Promise<void> {
  const id = msg.id as number | undefined;
  const source = ws.data.source;
  const type = String(msg.type ?? "");

  try {
    let result: unknown;
    switch (type) {
      case "get_states": {
        const map = await source.getStates();
        result = Object.values(map);
        break;
      }
      case "subscribe_entities":
        source.subscribeEntities((changed) => {
          send(ws, {
            type: "event",
            event: { event_type: "state_changed", data: changed },
          });
        });
        result = null;
        break;
      case "call_service":
        await source.callService(
          String(msg.domain ?? ""),
          String(msg.service ?? ""),
          (msg.service_data as Record<string, unknown> | undefined) ?? undefined,
          msg.target as { entity_id?: string | string[] } | undefined,
        );
        result = { context: { id: "mock", parent_id: null, user_id: null } };
        break;
      case "lovelace/dashboards/list":
        result = await source.getDashboards();
        break;
      case "lovelace/config":
        result = await source.getDashboardConfig(
          typeof msg.url_path === "string" ? msg.url_path : undefined,
        );
        break;
      case "lovelace/config/save":
        await source.saveDashboardConfig(
          String(msg.url_path ?? ""),
          msg.config as import("../app/types/dashboard.ts").LovelaceDashboardConfig,
        );
        result = null;
        break;
      default:
        throw new Error(`Unsupported type: ${type}`);
    }
    if (id != null) {
      send(ws, { type: "result", id, success: true, result });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (id != null) {
      send(ws, { type: "result", id, success: false, error: { code: "mock", message } });
    }
  }
}

export const haMockWebSocket = {
  open(ws: ServerWebSocket<HaMockWsData>): void {
    const source = new EmbeddedDataSource();
    ws.data = { source, authed: false, ready: false };
    void source.connect().then(() => {
      ws.data.ready = true;
      send(ws, { type: "auth_required", ha_version: "2024.1.0" });
    });
  },

  async message(ws: ServerWebSocket<HaMockWsData>, raw: string | Buffer): Promise<void> {
    if (!ws.data?.ready) return;
    const msg = JSON.parse(String(raw)) as Record<string, unknown>;
    if (!ws.data.authed) {
      if (msg.type === "auth") {
        ws.data.authed = true;
        send(ws, { type: "auth_ok", ha_version: "2024.1.0" });
      } else if (msg.type === "auth_required") {
        // ignore
      } else {
        send(ws, { type: "auth_invalid", message: "Auth required" });
      }
      return;
    }
    await handleRequest(ws, msg);
  },

  close(ws: ServerWebSocket<HaMockWsData>): void {
    ws.data?.source.disconnect();
  },
} satisfies Bun.WebSocketHandler<HaMockWsData>;
