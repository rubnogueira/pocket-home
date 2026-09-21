/**
 * HAWebSocketSource — connects directly to a real Home Assistant instance.
 * Speaks the native HA WebSocket API at ws://<host>/api/websocket.
 */

import type { DataSource } from "./data-source.ts";
import type { HassEntity, EntityState } from "../types/entity.ts";
import type { LovelaceDashboardConfig, DashboardListItem } from "../types/dashboard.ts";
import type { ServiceTarget } from "../types/action.ts";

export class HAWebSocketSource implements DataSource {
  private ws: WebSocket | null = null;
  private msgId = 0;
  private pending: Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }> =
    new Map();
  private entitySubs: Array<(changed: EntityState) => void> = [];
  private host: string;
  private token: string;

  constructor(host: string, token: string) {
    this.host = host.replace(/\/$/, "");
    this.token = token;
  }

  async connect(): Promise<void> {
    const wsUrl = this.host.replace(/^http/, "ws") + "/api/websocket";
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      this.ws = ws;

      ws.onclose = () => {
        this.ws = null;
      };
      ws.onerror = () => reject(new Error("WebSocket error"));

      ws.onmessage = (ev) => {
        const msg = JSON.parse(String(ev.data));
        if (msg.type === "auth_required") {
          ws.send(JSON.stringify({ type: "auth", access_token: this.token }));
        } else if (msg.type === "auth_ok") {
          ws.onmessage = (ev2) => this.handleMessage(JSON.parse(String(ev2.data)));
          resolve();
        } else if (msg.type === "auth_invalid") {
          reject(new Error("Auth failed: " + (msg.message ?? "")));
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
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN)
        return reject(new Error("Not connected"));
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
        else p.reject(new Error(msg.error?.message ?? "HA error"));
      }
      return;
    }

    if (msg.type === "event") {
      const event = msg.event as
        | { event_type?: string; data?: { new_state?: HassEntity; entity_id?: string } }
        | undefined;
      if (event?.event_type === "state_changed" && event.data?.new_state) {
        const e = event.data.new_state;
        const changed: EntityState = { [e.entity_id]: e };
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
    this.send({ type: "subscribe_events", event_type: "state_changed" }).catch(() => {});
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
    const msg: Record<string, unknown> = { type: "lovelace/config" };
    if (urlPath) msg.url_path = urlPath;
    return (await this.send(msg)) as LovelaceDashboardConfig;
  }

  async saveDashboardConfig(urlPath: string, config: LovelaceDashboardConfig): Promise<void> {
    await this.send({ type: "lovelace/config/save", url_path: urlPath, config });
  }
}
