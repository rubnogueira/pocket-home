/**
 * Pluggable data source interface.
 * Abstracts both real HA WebSocket and the mock Pocket server.
 */

import type { EntityState } from "../types/entity.ts";
import type { LovelaceDashboardConfig, DashboardListItem } from "../types/dashboard.ts";
import type { ServiceTarget } from "../types/action.ts";

export interface DataSource {
  /** Open the connection (WS auth, etc.). */
  connect(): Promise<void>;

  /** Tear down connection. */
  disconnect(): void;

  /** One-shot fetch of all entity states. */
  getStates(): Promise<EntityState>;

  /**
   * Subscribe to entity state changes.
   * The callback receives a partial map of changed entities.
   * Returns an unsubscribe function.
   */
  subscribeEntities(cb: (changed: EntityState) => void): () => void;

  /** Dispatch a service call. */
  callService(
    domain: string,
    service: string,
    data?: Record<string, unknown>,
    target?: ServiceTarget,
  ): Promise<void>;

  /** List available dashboards. */
  getDashboards(): Promise<DashboardListItem[]>;

  /** Load a dashboard config (omit urlPath for Overview / default). */
  getDashboardConfig(urlPath?: string): Promise<LovelaceDashboardConfig>;

  /** Persist a dashboard config. */
  saveDashboardConfig(urlPath: string, config: LovelaceDashboardConfig): Promise<void>;
}
