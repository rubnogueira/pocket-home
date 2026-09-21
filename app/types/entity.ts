/**
 * Home Assistant entity state model.
 * Mirrors the shape returned by `get_states` and `subscribe_entities`.
 */

export interface HassEntityAttributes {
  friendly_name?: string;
  icon?: string;
  entity_picture?: string;
  unit_of_measurement?: string;
  device_class?: string;
  state_class?: string;
  supported_features?: number;
  assumed_state?: boolean;
  attribution?: string;

  // Light attributes
  brightness?: number;
  color_temp?: number;
  color_temp_kelvin?: number;
  min_mireds?: number;
  max_mireds?: number;
  min_color_temp_kelvin?: number;
  max_color_temp_kelvin?: number;
  hs_color?: [number, number];
  rgb_color?: [number, number, number];
  xy_color?: [number, number];
  color_mode?: string;
  supported_color_modes?: string[];
  effect?: string;
  effect_list?: string[];

  // Climate attributes
  temperature?: number;
  target_temp_high?: number;
  target_temp_low?: number;
  current_temperature?: number;
  current_humidity?: number;
  humidity?: number;
  target_humidity?: number;
  hvac_modes?: string[];
  hvac_action?: string;
  fan_mode?: string;
  fan_modes?: string[];
  swing_mode?: string;
  swing_modes?: string[];
  preset_mode?: string;
  preset_modes?: string[];
  min_temp?: number;
  max_temp?: number;
  target_temp_step?: number;

  // Media player attributes
  media_title?: string;
  media_artist?: string;
  media_album_name?: string;
  media_content_type?: string;
  media_content_id?: string;
  media_duration?: number;
  media_position?: number;
  media_position_updated_at?: string;
  media_image_url?: string;
  volume_level?: number;
  is_volume_muted?: boolean;
  source?: string;
  source_list?: string[];
  sound_mode?: string;
  sound_mode_list?: string[];
  shuffle?: boolean;
  repeat?: string;

  // Cover attributes
  current_position?: number;
  current_tilt_position?: number;

  // Weather attributes
  forecast?: WeatherForecast[];
  wind_speed?: number;
  wind_bearing?: number;
  pressure?: number;
  visibility?: number;

  // Sensor attributes
  state_class_measurement?: string;

  // Person/zone
  latitude?: number;
  longitude?: number;
  gps_accuracy?: number;

  // Alarm
  code_format?: string;
  code_arm_required?: boolean;
  changed_by?: string;

  // Lock
  is_locked?: boolean;
  is_locking?: boolean;
  is_unlocking?: boolean;
  is_jammed?: boolean;

  // Update
  installed_version?: string;
  latest_version?: string;
  in_progress?: boolean | number;
  release_summary?: string;
  release_url?: string;
  skipped_version?: string;
  title?: string;

  // Catch-all for domain-specific attributes
  [key: string]: unknown;
}

export interface WeatherForecast {
  datetime: string;
  condition?: string;
  temperature?: number;
  templow?: number;
  precipitation?: number;
  precipitation_probability?: number;
  humidity?: number;
  wind_speed?: number;
  wind_bearing?: number;
  is_daytime?: boolean;
}

export interface HassEntityContext {
  id: string;
  parent_id?: string | null;
  user_id?: string | null;
}

export interface HassEntity {
  entity_id: string;
  state: string;
  attributes: HassEntityAttributes;
  last_changed: string;
  last_updated: string;
  last_reported?: string;
  context: HassEntityContext;
}

/** Extract the domain from an entity_id, e.g. "light" from "light.living_room". */
export function entityDomain(entityId: string): string {
  return entityId.split(".")[0] ?? "";
}

/** Extract the object_id from an entity_id, e.g. "living_room" from "light.living_room". */
export function entityObjectId(entityId: string): string {
  return entityId.split(".")[1] ?? "";
}

/** Domains that have a primary on/off state. */
export const TOGGLE_DOMAINS = new Set([
  "automation",
  "cover",
  "fan",
  "group",
  "input_boolean",
  "light",
  "media_player",
  "remote",
  "siren",
  "switch",
  "vacuum",
]);

/** Map domain to a default icon name. */
export const DOMAIN_ICONS: Record<string, string> = {
  alarm_control_panel: "shield",
  automation: "robot",
  binary_sensor: "eye",
  button: "gesture-tap-button",
  calendar: "calendar",
  camera: "video",
  climate: "thermostat",
  cover: "window-open",
  date: "calendar",
  datetime: "calendar-clock",
  event: "alert-circle",
  fan: "fan",
  group: "google-circles-communities",
  humidifier: "air-humidifier",
  input_boolean: "toggle-switch",
  input_button: "gesture-tap-button",
  input_datetime: "calendar-clock",
  input_number: "ray-vertex",
  input_select: "format-list-bulleted",
  input_text: "form-textbox",
  light: "lightbulb",
  lock: "lock",
  media_player: "cast",
  number: "ray-vertex",
  person: "account",
  plant: "flower",
  remote: "remote",
  scene: "palette",
  script: "script-text",
  select: "format-list-bulleted",
  sensor: "eye",
  siren: "bullhorn",
  sun: "white-balance-sunny",
  switch: "flash",
  text: "form-textbox",
  time: "clock",
  timer: "timer",
  todo: "clipboard-list",
  update: "package-up",
  vacuum: "robot-vacuum",
  valve: "pipe-valve",
  water_heater: "thermometer",
  weather: "weather-cloudy",
  zone: "map-marker-radius",
};

export type EntityState = Record<string, HassEntity>;
