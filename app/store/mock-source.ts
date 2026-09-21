/**
 * MockDataSource — connects to the Bun server's WebSocket.
 * Implements the DataSource interface using the HA-compatible WS protocol.
 */

import type { DataSource } from "./data-source.ts";
import type { HassEntity, EntityState } from "../types/entity.ts";
import type { LovelaceDashboardConfig, DashboardListItem } from "../types/dashboard.ts";
import type { ServiceTarget } from "../types/action.ts";

export class MockDataSource implements DataSource {
  private ws: WebSocket | null = null;
  private msgId = 0;
  private pending: Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }> =
    new Map();
  private entitySubs: Array<(changed: EntityState) => void> = [];
  private url: string;

  constructor(url: string) {
    this.url = url;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      // 5-second timeout to prevent blocking if the server is unreachable.
      const timeout = setTimeout(() => {
        if (this.ws) {
          this.ws.close();
          this.ws = null;
        }
        reject(new Error("Connection timeout"));
      }, 5000);

      let ws: WebSocket;
      try {
        ws = new WebSocket(this.url);
      } catch {
        clearTimeout(timeout);
        reject(new Error("WebSocket constructor failed"));
        return;
      }
      this.ws = ws;

      ws.onmessage = (ev) => {
        const msg = JSON.parse(String(ev.data));
        this.handleMessage(msg);
      };

      ws.onopen = () => {};

      ws.onerror = () => {
        clearTimeout(timeout);
        reject(new Error("WebSocket error"));
      };

      ws.onclose = () => {
        this.ws = null;
      };

      // Wait for auth_required then send auth, then resolve on auth_ok.
      const origHandler = ws.onmessage;
      ws.onmessage = (ev) => {
        const msg = JSON.parse(String(ev.data));
        if (msg.type === "auth_required") {
          ws.send(JSON.stringify({ type: "auth", access_token: "mock" }));
        } else if (msg.type === "auth_ok") {
          clearTimeout(timeout);
          ws.onmessage = origHandler;
          resolve();
        } else if (msg.type === "auth_invalid") {
          clearTimeout(timeout);
          reject(new Error("Auth failed"));
        }
      };
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.pending.clear();
    this.entitySubs = [];
  }

  private nextId(): number {
    return ++this.msgId;
  }

  private send(msg: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return reject(new Error("Not connected"));
      }
      const id = this.nextId();
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ ...msg, id }));
    });
  }

  private handleMessage(msg: {
    id?: number;
    type: string;
    success?: boolean;
    result?: unknown;
    event?: unknown;
    error?: { message?: string };
  }) {
    if (msg.type === "result" && msg.id != null) {
      const p = this.pending.get(msg.id);
      if (p) {
        this.pending.delete(msg.id);
        if (msg.success) p.resolve(msg.result);
        else p.reject(new Error(msg.error?.message ?? "Unknown error"));
      }
      return;
    }

    if (msg.type === "event") {
      const event = msg.event as
        | { event_type?: string; data?: Record<string, unknown> }
        | undefined;
      if (event?.event_type === "state_changed" && event.data) {
        const changed: EntityState = {};
        for (const [eid, val] of Object.entries(event.data)) {
          changed[eid] = val as HassEntity;
        }
        for (const cb of this.entitySubs) cb(changed);
      }
    }
  }

  async getStates(): Promise<EntityState> {
    const result = (await this.send({ type: "get_states" })) as HassEntity[];
    const map: EntityState = {};
    for (const e of result) map[e.entity_id] = e;
    return map;
  }

  subscribeEntities(cb: (changed: EntityState) => void): () => void {
    this.entitySubs.push(cb);
    // Trigger subscription on server.
    this.send({ type: "subscribe_entities" }).catch(() => {});
    return () => {
      this.entitySubs = this.entitySubs.filter((c) => c !== cb);
    };
  }

  async callService(
    domain: string,
    service: string,
    data?: Record<string, unknown>,
    target?: ServiceTarget,
  ): Promise<void> {
    await this.send({ type: "call_service", domain, service, service_data: data, target });
  }

  async getDashboards(): Promise<DashboardListItem[]> {
    return (await this.send({ type: "lovelace/dashboards/list" })) as DashboardListItem[];
  }

  async getDashboardConfig(urlPath?: string): Promise<LovelaceDashboardConfig> {
    return (await this.send({
      type: "lovelace/config",
      url_path: urlPath,
    })) as LovelaceDashboardConfig;
  }

  async saveDashboardConfig(urlPath: string, config: LovelaceDashboardConfig): Promise<void> {
    await this.send({ type: "lovelace/config/save", url_path: urlPath, config });
  }
}
