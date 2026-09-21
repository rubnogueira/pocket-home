/**
 * Lovelace badge configs.
 * Mirrors home-assistant/frontend create-badge-element.ts.
 */

import type { ActionableConfig } from "./action.ts";
import type { VisibilityCondition } from "./condition.ts";

export interface EntityBadgeConfig extends ActionableConfig {
  type: "entity";
  entity: string;
  /** Optional display override (demo Lovelace snapshots). */
  state?: string;
  name?: string;
  icon?: string;
  color?: string;
  show_name?: boolean;
  show_state?: boolean;
  show_icon?: boolean;
  state_content?: string | string[];
  visibility?: VisibilityCondition[];
  display_type?: "standard" | "complete";
}

export interface ShortcutBadgeConfig extends ActionableConfig {
  type: "shortcut";
  name?: string;
  icon?: string;
  color?: string;
  visibility?: VisibilityCondition[];
}

export interface EntityFilterBadgeConfig {
  type: "entity-filter";
  entities: (string | EntityBadgeConfig)[];
  state_filter?: (string | { key: string; operator: string; value: string })[];
  conditions?: VisibilityCondition[];
}

export interface StateLabelBadgeConfig extends ActionableConfig {
  type: "state-label";
  entity: string;
  name?: string;
  icon?: string;
  attribute?: string;
  prefix?: string;
  suffix?: string;
  show_name?: boolean;
  visibility?: VisibilityCondition[];
}

export interface ErrorBadgeConfig {
  type: "error";
  error: string;
  origConfig?: LovelaceBadgeConfig;
}

export interface PowerTotalBadgeConfig {
  type: "power-total";
  entity?: string;
  name?: string;
  icon?: string;
  visibility?: VisibilityCondition[];
}

export interface GasTotalBadgeConfig {
  type: "gas-total";
  entity?: string;
  name?: string;
  icon?: string;
  visibility?: VisibilityCondition[];
}

export interface WaterTotalBadgeConfig {
  type: "water-total";
  entity?: string;
  name?: string;
  icon?: string;
  visibility?: VisibilityCondition[];
}

export type LovelaceBadgeConfig =
  | EntityBadgeConfig
  | ShortcutBadgeConfig
  | EntityFilterBadgeConfig
  | StateLabelBadgeConfig
  | ErrorBadgeConfig
  | PowerTotalBadgeConfig
  | GasTotalBadgeConfig
  | WaterTotalBadgeConfig;

export const BADGE_TYPES = [
  "entity",
  "error",
  "entity-filter",
  "shortcut",
  "state-label",
  "power-total",
  "gas-total",
  "water-total",
] as const;

export type BadgeType = (typeof BADGE_TYPES)[number];
