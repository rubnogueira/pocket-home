/**
 * Dashboard config store.
 * Holds the loaded dashboard config, current view index, and navigation.
 */

import { reactive, computed } from "vue";
import type { LovelaceDashboardConfig, DashboardListItem } from "../types/dashboard.ts";
import type { LovelaceViewConfig } from "../types/view.ts";
import type { DataSource } from "./data-source.ts";

export interface DashboardStore {
  /** List of available dashboards. */
  dashboards: DashboardListItem[];
  /** Currently loaded dashboard config. */
  config: LovelaceDashboardConfig | null;
  /** Currently active view index. */
  viewIndex: number;
  /** Current view config (computed). */
  readonly currentView: LovelaceViewConfig | undefined;
  /** Load dashboard list and default config. */
  init(source: DataSource): Promise<void>;
  /** Switch to a different dashboard. */
  loadDashboard(source: DataSource, urlPath?: string): Promise<void>;
  /** Switch view within the current dashboard. */
  setView(index: number): void;
}

export function createDashboardStore(): DashboardStore {
  const store = reactive({
    dashboards: [] as DashboardListItem[],
    config: null as LovelaceDashboardConfig | null,
    viewIndex: 0,
  });

  const currentView = computed(() => {
    if (!store.config) return undefined;
    return store.config.views[store.viewIndex];
  });

  async function init(source: DataSource): Promise<void> {
    store.dashboards = await source.getDashboards();
    store.config = await source.getDashboardConfig();
    store.viewIndex = 0;
  }

  async function loadDashboard(source: DataSource, urlPath?: string): Promise<void> {
    store.config = await source.getDashboardConfig(urlPath);
    store.viewIndex = 0;
  }

  function setView(index: number): void {
    if (store.config && index >= 0 && index < store.config.views.length) {
      store.viewIndex = index;
    }
  }

  return {
    get dashboards() {
      return store.dashboards;
    },
    set dashboards(v) {
      store.dashboards = v;
    },
    get config() {
      return store.config;
    },
    set config(v) {
      store.config = v;
    },
    get viewIndex() {
      return store.viewIndex;
    },
    set viewIndex(v) {
      store.viewIndex = v;
    },
    get currentView() {
      return currentView.value;
    },
    init,
    loadDashboard,
    setView,
  };
}
