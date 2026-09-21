/**
 * Lovelace picture-elements element configs.
 * Used inside `picture-elements` card's `elements` array.
 */

import type { ActionableConfig } from "./action.ts";
import type { VisibilityCondition } from "./condition.ts";

export interface BaseElementConfig {
  type: string;
  style?: Record<string, string | number>;
}

export interface StateIconElementConfig extends BaseElementConfig, ActionableConfig {
  type: "state-icon";
  entity: string;
  icon?: string;
  state_color?: boolean;
}

export interface StateBadgeElementConfig extends BaseElementConfig, ActionableConfig {
  type: "state-badge";
  entity: string;
}

export interface StateLabelElementConfig extends BaseElementConfig, ActionableConfig {
  type: "state-label";
  entity: string;
  attribute?: string;
  prefix?: string;
  suffix?: string;
}

export interface IconElementConfig extends BaseElementConfig, ActionableConfig {
  type: "icon";
  icon: string;
  title?: string;
  entity?: string;
}

export interface ImageElementConfig extends BaseElementConfig, ActionableConfig {
  type: "image";
  entity?: string;
  image?: string;
  camera_image?: string;
  camera_view?: "auto" | "live";
  state_image?: Record<string, string>;
  filter?: string;
  state_filter?: Record<string, string>;
  aspect_ratio?: string;
}

export interface ServiceButtonElementConfig extends BaseElementConfig {
  type: "service-button";
  title: string;
  service: string;
  service_data?: Record<string, unknown>;
}

export interface ConditionalElementConfig extends BaseElementConfig {
  type: "conditional";
  conditions: VisibilityCondition[];
  elements: LovelaceElementConfig[];
}

export type LovelaceElementConfig =
  | StateIconElementConfig
  | StateBadgeElementConfig
  | StateLabelElementConfig
  | IconElementConfig
  | ImageElementConfig
  | ServiceButtonElementConfig
  | ConditionalElementConfig;

export const ELEMENT_TYPES = [
  "state-icon",
  "state-badge",
  "state-label",
  "icon",
  "image",
  "service-button",
  "conditional",
] as const;

export type ElementType = (typeof ELEMENT_TYPES)[number];
