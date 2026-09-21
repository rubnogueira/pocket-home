/**
 * Lovelace header/footer configs.
 * Used on cards via `header` and `footer` properties.
 */

import type { ActionableConfig } from "./action.ts";

export interface PictureHeaderFooterConfig {
  type: "picture";
  image: string;
  alt_text?: string;
  tap_action?: ActionableConfig["tap_action"];
  hold_action?: ActionableConfig["hold_action"];
  double_tap_action?: ActionableConfig["double_tap_action"];
}

export interface ButtonsHeaderFooterConfig {
  type: "buttons";
  entities: ButtonsHeaderFooterEntity[];
}

export interface ButtonsHeaderFooterEntity extends ActionableConfig {
  entity: string;
  name?: string;
  icon?: string;
  image?: string;
  show_name?: boolean;
  show_icon?: boolean;
}

export interface GraphHeaderFooterConfig {
  type: "graph";
  entity: string;
  detail?: number;
  hours_to_show?: number;
  limits?: { min?: number; max?: number };
}

export type LovelaceHeaderFooterConfig =
  | PictureHeaderFooterConfig
  | ButtonsHeaderFooterConfig
  | GraphHeaderFooterConfig;
