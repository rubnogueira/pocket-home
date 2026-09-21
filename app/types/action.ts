/**
 * Lovelace action configuration.
 * Mirrors home-assistant/frontend `src/data/lovelace/config/action.ts`.
 */

export interface ConfirmationRestrictionConfig {
  text?: string;
  title?: string;
  confirm_text?: string;
  dismiss_text?: string;
  exemptions?: { user: string }[];
}

export interface BaseActionConfig {
  action: string;
  confirmation?: ConfirmationRestrictionConfig;
}

export interface ToggleActionConfig extends BaseActionConfig {
  action: "toggle";
}

export interface CallServiceActionConfig extends BaseActionConfig {
  action: "call-service" | "perform-action";
  /** @deprecated Use perform_action instead. */
  service?: string;
  perform_action: string;
  target?: ServiceTarget;
  /** @deprecated Use data instead. */
  service_data?: Record<string, unknown>;
  data?: Record<string, unknown>;
}

export interface NavigateActionConfig extends BaseActionConfig {
  action: "navigate";
  navigation_path: string;
  navigation_replace?: boolean;
}

export interface UrlActionConfig extends BaseActionConfig {
  action: "url";
  url_path: string;
}

export interface MoreInfoActionConfig extends BaseActionConfig {
  action: "more-info";
  entity?: string;
}

export interface AssistActionConfig extends BaseActionConfig {
  action: "assist";
  pipeline_id?: string;
  start_listening?: boolean;
}

export interface NoActionConfig extends BaseActionConfig {
  action: "none";
}

export interface FireDomEventActionConfig extends BaseActionConfig {
  action: "fire-dom-event";
}

export type ActionConfig =
  | ToggleActionConfig
  | CallServiceActionConfig
  | NavigateActionConfig
  | UrlActionConfig
  | MoreInfoActionConfig
  | AssistActionConfig
  | NoActionConfig
  | FireDomEventActionConfig;

/** Service call target — entity_id, device_id, area_id, floor_id, label_id. */
export interface ServiceTarget {
  entity_id?: string | string[];
  device_id?: string | string[];
  area_id?: string | string[];
  floor_id?: string | string[];
  label_id?: string | string[];
}

/** Common action fields on cards/badges. */
export interface ActionableConfig {
  tap_action?: ActionConfig;
  hold_action?: ActionConfig;
  double_tap_action?: ActionConfig;
}
