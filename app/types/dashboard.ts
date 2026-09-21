/**
 * Top-level Lovelace dashboard config.
 */

import type { LovelaceViewConfig } from "./view.ts";

export interface LovelaceDashboardConfig {
  title?: string;
  views: LovelaceViewConfig[];
  background?: string;
  /** Resources for custom cards (HACS). Not used by Pocket renderer. */
  resources?: LovelaceResource[];
}

export interface LovelaceResource {
  type: "module" | "css" | "js";
  url: string;
}

export interface DashboardListItem {
  id?: string;
  url_path: string;
  title: string;
  icon?: string;
  show_in_sidebar?: boolean;
  require_admin?: boolean;
  mode?: "storage" | "yaml";
}
