/**
 * Lovelace entity row configs.
 * Used inside the `entities` card's `entities` array.
 * Mirrors home-assistant/frontend create-row-element.ts.
 */

import type { ActionableConfig } from "./action.ts";
import type { VisibilityCondition } from "./condition.ts";

// --- Entity rows (domain-based auto-detection) ---

export interface EntityRowConfig extends ActionableConfig {
  type?: string;
  entity: string;
  name?: string;
  icon?: string;
  image?: string;
  secondary_info?: string;
  state_color?: boolean;
}

export interface ToggleEntityRowConfig extends EntityRowConfig {
  type: "toggle-entity";
}

export interface SensorEntityRowConfig extends EntityRowConfig {
  type: "sensor-entity";
  graph?: "line" | "none";
  unit?: string;
}

export interface SimpleEntityRowConfig extends EntityRowConfig {
  type: "simple-entity";
}

export interface ButtonEntityRowConfig extends EntityRowConfig {
  type: "button-entity";
  action_name?: string;
}

export interface ClimateEntityRowConfig extends EntityRowConfig {
  type: "climate-entity";
}

export interface CoverEntityRowConfig extends EntityRowConfig {
  type: "cover-entity";
}

export interface DateEntityRowConfig extends EntityRowConfig {
  type: "date-entity";
}

export interface DatetimeEntityRowConfig extends EntityRowConfig {
  type: "datetime-entity";
}

export interface EventEntityRowConfig extends EntityRowConfig {
  type: "event-entity";
}

export interface FanEntityRowConfig extends EntityRowConfig {
  type: "fan-entity";
}

export interface GroupEntityRowConfig extends EntityRowConfig {
  type: "group-entity";
}

export interface HumidifierEntityRowConfig extends EntityRowConfig {
  type: "humidifier-entity";
}

export interface InputButtonEntityRowConfig extends EntityRowConfig {
  type: "input-button-entity";
}

export interface InputDatetimeEntityRowConfig extends EntityRowConfig {
  type: "input-datetime-entity";
}

export interface InputNumberEntityRowConfig extends EntityRowConfig {
  type: "input-number-entity";
}

export interface InputSelectEntityRowConfig extends EntityRowConfig {
  type: "input-select-entity";
}

export interface InputTextEntityRowConfig extends EntityRowConfig {
  type: "input-text-entity";
}

export interface LockEntityRowConfig extends EntityRowConfig {
  type: "lock-entity";
}

export interface MediaPlayerEntityRowConfig extends EntityRowConfig {
  type: "media-player-entity";
}

export interface NumberEntityRowConfig extends EntityRowConfig {
  type: "number-entity";
}

export interface SceneEntityRowConfig extends EntityRowConfig {
  type: "scene-entity";
}

export interface ScriptEntityRowConfig extends EntityRowConfig {
  type: "script-entity";
}

export interface SelectEntityRowConfig extends EntityRowConfig {
  type: "select-entity";
}

export interface TextEntityRowConfig extends EntityRowConfig {
  type: "text-entity";
}

export interface TimeEntityRowConfig extends EntityRowConfig {
  type: "time-entity";
}

export interface TimerEntityRowConfig extends EntityRowConfig {
  type: "timer-entity";
}

export interface UpdateEntityRowConfig extends EntityRowConfig {
  type: "update-entity";
}

export interface ValveEntityRowConfig extends EntityRowConfig {
  type: "valve-entity";
}

export interface WeatherEntityRowConfig extends EntityRowConfig {
  type: "weather-entity";
}

// --- Special rows ---

export interface DividerRowConfig {
  type: "divider";
  style?: Record<string, string>;
}

export interface SectionRowConfig {
  type: "section";
  label?: string;
}

export interface ButtonRowConfig extends ActionableConfig {
  type: "button";
  entity?: string;
  name?: string;
  icon?: string;
  action_name?: string;
}

export interface CallServiceRowConfig {
  type: "call-service";
  name?: string;
  icon?: string;
  action_name?: string;
  service: string;
  service_data?: Record<string, unknown>;
}

export interface WebLinkRowConfig {
  type: "weblink";
  name?: string;
  icon?: string;
  url: string;
}

export interface CastRowConfig {
  type: "cast";
  name?: string;
  icon?: string;
  view?: string | number;
  dashboard?: string;
  hide_if_unavailable?: boolean;
}

export interface ButtonsRowConfig {
  type: "buttons";
  entities: (string | EntityRowConfig)[];
}

export interface AttributeRowConfig {
  type: "attribute";
  entity: string;
  attribute: string;
  name?: string;
  icon?: string;
  prefix?: string;
  suffix?: string;
}

export interface TextRowConfig {
  type: "text";
  name: string;
  text: string;
  icon?: string;
}

export interface ConditionalRowConfig {
  type: "conditional";
  conditions: VisibilityCondition[];
  row: LovelaceRowConfig;
}

export type LovelaceRowConfig =
  | string
  | EntityRowConfig
  | ToggleEntityRowConfig
  | SensorEntityRowConfig
  | SimpleEntityRowConfig
  | ButtonEntityRowConfig
  | ClimateEntityRowConfig
  | CoverEntityRowConfig
  | DateEntityRowConfig
  | DatetimeEntityRowConfig
  | EventEntityRowConfig
  | FanEntityRowConfig
  | GroupEntityRowConfig
  | HumidifierEntityRowConfig
  | InputButtonEntityRowConfig
  | InputDatetimeEntityRowConfig
  | InputNumberEntityRowConfig
  | InputSelectEntityRowConfig
  | InputTextEntityRowConfig
  | LockEntityRowConfig
  | MediaPlayerEntityRowConfig
  | NumberEntityRowConfig
  | SceneEntityRowConfig
  | ScriptEntityRowConfig
  | SelectEntityRowConfig
  | TextEntityRowConfig
  | TimeEntityRowConfig
  | TimerEntityRowConfig
  | UpdateEntityRowConfig
  | ValveEntityRowConfig
  | WeatherEntityRowConfig
  | DividerRowConfig
  | SectionRowConfig
  | ButtonRowConfig
  | CallServiceRowConfig
  | WebLinkRowConfig
  | CastRowConfig
  | ButtonsRowConfig
  | AttributeRowConfig
  | TextRowConfig
  | ConditionalRowConfig;

/**
 * Domain → entity row type mapping.
 * When an entities card entry has no explicit `type`, the domain of the
 * entity_id determines which row component renders it.
 */
export const DOMAIN_TO_ROW_TYPE: Record<string, string> = {
  _domain_not_found: "simple",
  alert: "toggle",
  automation: "toggle",
  button: "button",
  climate: "climate",
  cover: "cover",
  date: "date",
  datetime: "datetime",
  event: "event",
  fan: "fan",
  group: "group",
  humidifier: "humidifier",
  input_boolean: "toggle",
  input_button: "input-button",
  input_datetime: "input-datetime",
  input_number: "input-number",
  input_select: "input-select",
  input_text: "input-text",
  light: "toggle",
  lock: "lock",
  media_player: "media-player",
  number: "number",
  remote: "toggle",
  scene: "scene",
  script: "script",
  select: "select",
  sensor: "sensor",
  siren: "toggle",
  switch: "toggle",
  text: "text",
  time: "time",
  timer: "timer",
  update: "update",
  vacuum: "toggle",
  valve: "valve",
  water_heater: "climate",
  weather: "weather",
};
