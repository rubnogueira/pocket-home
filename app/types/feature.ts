/**
 * Lovelace card feature configs.
 * Complete catalog from home-assistant/frontend create-card-feature-element.ts.
 */

export interface AlarmModesFeatureConfig {
  type: "alarm-modes";
  modes?: string[];
}

export interface AreaControlsFeatureConfig {
  type: "area-controls";
  entity_id?: string;
}

export interface BarGaugeFeatureConfig {
  type: "bar-gauge";
  entity_id?: string;
  attribute?: string;
  min?: number;
  max?: number;
  unit?: string;
}

export interface ButtonFeatureConfig {
  type: "button";
  entity_id?: string;
  icon?: string;
  name?: string;
  tap_action?: unknown;
}

export interface ClimateFanModesFeatureConfig {
  type: "climate-fan-modes";
  style?: "dropdown" | "icons";
  fan_modes?: string[];
}

export interface ClimateSwingModesFeatureConfig {
  type: "climate-swing-modes";
  style?: "dropdown" | "icons";
  swing_modes?: string[];
}

export interface ClimateSwingHorizontalModesFeatureConfig {
  type: "climate-swing-horizontal-modes";
  style?: "dropdown" | "icons";
  swing_modes?: string[];
}

export interface ClimateHvacModesFeatureConfig {
  type: "climate-hvac-modes";
  style?: "dropdown" | "icons";
  hvac_modes?: string[];
}

export interface ClimatePresetModesFeatureConfig {
  type: "climate-preset-modes";
  style?: "dropdown" | "icons";
  preset_modes?: string[];
}

export interface CounterActionsFeatureConfig {
  type: "counter-actions";
}

export interface CoverOpenCloseFeatureConfig {
  type: "cover-open-close";
}

export interface CoverPositionFavoriteFeatureConfig {
  type: "cover-position-favorite";
}

export interface CoverPositionFeatureConfig {
  type: "cover-position";
}

export interface CoverTiltFeatureConfig {
  type: "cover-tilt";
}

export interface CoverTiltFavoriteFeatureConfig {
  type: "cover-tilt-favorite";
}

export interface CoverTiltPositionFeatureConfig {
  type: "cover-tilt-position";
}

export interface DateSetFeatureConfig {
  type: "date-set";
}

export interface FanDirectionFeatureConfig {
  type: "fan-direction";
}

export interface FanOscillateFeatureConfig {
  type: "fan-oscillate";
}

export interface FanPresetModesFeatureConfig {
  type: "fan-preset-modes";
  style?: "dropdown" | "icons";
  preset_modes?: string[];
}

export interface FanSpeedFeatureConfig {
  type: "fan-speed";
}

export interface HumidifierModesFeatureConfig {
  type: "humidifier-modes";
  style?: "dropdown" | "icons";
  modes?: string[];
}

export interface HumidifierToggleFeatureConfig {
  type: "humidifier-toggle";
}

export interface LawnMowerCommandsFeatureConfig {
  type: "lawn-mower-commands";
}

export interface LightBrightnessFeatureConfig {
  type: "light-brightness";
}

export interface LightColorTempFeatureConfig {
  type: "light-color-temp";
}

export interface LightColorFavoritesFeatureConfig {
  type: "light-color-favorites";
  colors?: string[];
}

export interface LightEffectFeatureConfig {
  type: "light-effect";
}

export interface LockCommandsFeatureConfig {
  type: "lock-commands";
}

export interface LockOpenDoorFeatureConfig {
  type: "lock-open-door";
}

export interface MediaPlayerPlaybackFeatureConfig {
  type: "media-player-playback";
}

export interface MediaPlayerSoundModeFeatureConfig {
  type: "media-player-sound-mode";
}

export interface MediaPlayerSourceFeatureConfig {
  type: "media-player-source";
}

export interface MediaPlayerVolumeButtonsFeatureConfig {
  type: "media-player-volume-buttons";
}

export interface MediaPlayerVolumeSliderFeatureConfig {
  type: "media-player-volume-slider";
}

export interface NumericInputFeatureConfig {
  type: "numeric-input";
  style?: "slider" | "buttons";
}

export interface PrecipitationForecastFeatureConfig {
  type: "precipitation-forecast";
}

export interface SelectOptionsFeatureConfig {
  type: "select-options";
}

export interface TrendGraphFeatureConfig {
  type: "trend-graph";
  entity_id?: string;
  hours_to_show?: number;
}

export interface TargetHumidityFeatureConfig {
  type: "target-humidity";
}

export interface TargetTemperatureFeatureConfig {
  type: "target-temperature";
}

export interface TemperatureForecastFeatureConfig {
  type: "temperature-forecast";
}

export interface TimerActionsFeatureConfig {
  type: "timer-actions";
}

export interface TimerPresetsFeatureConfig {
  type: "timer-presets";
  presets?: Record<string, number>;
}

export interface ToggleFeatureConfig {
  type: "toggle";
}

export interface UpdateActionsFeatureConfig {
  type: "update-actions";
  backup?: "ask" | "yes" | "no";
}

export interface VacuumCommandsFeatureConfig {
  type: "vacuum-commands";
}

export interface VacuumFanSpeedFeatureConfig {
  type: "vacuum-fan-speed";
}

export interface ValveOpenCloseFeatureConfig {
  type: "valve-open-close";
}

export interface ValvePositionFavoriteFeatureConfig {
  type: "valve-position-favorite";
}

export interface ValvePositionFeatureConfig {
  type: "valve-position";
}

export interface WaterHeaterOperationModesFeatureConfig {
  type: "water-heater-operation-modes";
  operation_modes?: string[];
}

export type LovelaceCardFeatureConfig =
  | AlarmModesFeatureConfig
  | AreaControlsFeatureConfig
  | BarGaugeFeatureConfig
  | ButtonFeatureConfig
  | ClimateFanModesFeatureConfig
  | ClimateSwingModesFeatureConfig
  | ClimateSwingHorizontalModesFeatureConfig
  | ClimateHvacModesFeatureConfig
  | ClimatePresetModesFeatureConfig
  | CounterActionsFeatureConfig
  | CoverOpenCloseFeatureConfig
  | CoverPositionFavoriteFeatureConfig
  | CoverPositionFeatureConfig
  | CoverTiltFeatureConfig
  | CoverTiltFavoriteFeatureConfig
  | CoverTiltPositionFeatureConfig
  | DateSetFeatureConfig
  | FanDirectionFeatureConfig
  | FanOscillateFeatureConfig
  | FanPresetModesFeatureConfig
  | FanSpeedFeatureConfig
  | HumidifierModesFeatureConfig
  | HumidifierToggleFeatureConfig
  | LawnMowerCommandsFeatureConfig
  | LightBrightnessFeatureConfig
  | LightColorTempFeatureConfig
  | LightColorFavoritesFeatureConfig
  | LightEffectFeatureConfig
  | LockCommandsFeatureConfig
  | LockOpenDoorFeatureConfig
  | MediaPlayerPlaybackFeatureConfig
  | MediaPlayerSoundModeFeatureConfig
  | MediaPlayerSourceFeatureConfig
  | MediaPlayerVolumeButtonsFeatureConfig
  | MediaPlayerVolumeSliderFeatureConfig
  | NumericInputFeatureConfig
  | PrecipitationForecastFeatureConfig
  | SelectOptionsFeatureConfig
  | TrendGraphFeatureConfig
  | TargetHumidityFeatureConfig
  | TargetTemperatureFeatureConfig
  | TemperatureForecastFeatureConfig
  | TimerActionsFeatureConfig
  | TimerPresetsFeatureConfig
  | ToggleFeatureConfig
  | UpdateActionsFeatureConfig
  | VacuumCommandsFeatureConfig
  | VacuumFanSpeedFeatureConfig
  | ValveOpenCloseFeatureConfig
  | ValvePositionFavoriteFeatureConfig
  | ValvePositionFeatureConfig
  | WaterHeaterOperationModesFeatureConfig;

/** All known feature type strings. */
export const FEATURE_TYPES = [
  "alarm-modes",
  "area-controls",
  "bar-gauge",
  "button",
  "climate-fan-modes",
  "climate-swing-modes",
  "climate-swing-horizontal-modes",
  "climate-hvac-modes",
  "climate-preset-modes",
  "counter-actions",
  "cover-open-close",
  "cover-position-favorite",
  "cover-position",
  "cover-tilt",
  "cover-tilt-favorite",
  "cover-tilt-position",
  "date-set",
  "fan-direction",
  "fan-oscillate",
  "fan-preset-modes",
  "fan-speed",
  "humidifier-modes",
  "humidifier-toggle",
  "lawn-mower-commands",
  "light-brightness",
  "light-color-temp",
  "light-color-favorites",
  "light-effect",
  "lock-commands",
  "lock-open-door",
  "media-player-playback",
  "media-player-sound-mode",
  "media-player-source",
  "media-player-volume-buttons",
  "media-player-volume-slider",
  "numeric-input",
  "precipitation-forecast",
  "select-options",
  "trend-graph",
  "target-humidity",
  "target-temperature",
  "temperature-forecast",
  "timer-actions",
  "timer-presets",
  "toggle",
  "update-actions",
  "vacuum-commands",
  "vacuum-fan-speed",
  "valve-open-close",
  "valve-position-favorite",
  "valve-position",
  "water-heater-operation-modes",
] as const;

export type FeatureType = (typeof FEATURE_TYPES)[number];
