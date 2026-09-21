/**
 * Lovelace card configs — complete catalog.
 * Every card type registered in home-assistant/frontend create-card-element.ts.
 */

import type { ActionableConfig } from "./action.ts";
import type { LovelaceBadgeConfig } from "./badge.ts";
import type { VisibilityCondition, LegacyCondition } from "./condition.ts";
import type { LovelaceElementConfig } from "./element.ts";
import type { LovelaceCardFeatureConfig } from "./feature.ts";
import type { LovelaceGridOptions, LovelaceLayoutOptions } from "./grid-options.ts";
import type { LovelaceHeaderFooterConfig } from "./header-footer.ts";
import type { LovelaceRowConfig } from "./row.ts";

// --- Base card config ---

export interface BaseCardConfig {
  type: string;
  index?: number;
  view_index?: number;
  view_layout?: unknown;
  /** @deprecated Use grid_options instead. */
  layout_options?: LovelaceLayoutOptions;
  grid_options?: LovelaceGridOptions;
  visibility?: VisibilityCondition[];
  disabled?: boolean;
}

// --- P0: Always loaded ---

export interface TileCardConfig extends BaseCardConfig, ActionableConfig {
  type: "tile";
  entity: string;
  name?: string;
  icon?: string;
  color?: string;
  show_entity_picture?: boolean;
  vertical?: boolean;
  hide_state?: boolean;
  state_content?: string | string[];
  features?: LovelaceCardFeatureConfig[];
}

export interface EntitiesCardConfig extends BaseCardConfig {
  type: "entities";
  entities: LovelaceRowConfig[];
  title?: string;
  icon?: string;
  show_header_toggle?: boolean;
  state_color?: boolean;
  header?: LovelaceHeaderFooterConfig;
  footer?: LovelaceHeaderFooterConfig;
}

export interface ButtonCardConfig extends BaseCardConfig, ActionableConfig {
  type: "button";
  entity?: string;
  name?: string;
  icon?: string;
  icon_height?: string;
  show_name?: boolean;
  show_icon?: boolean;
  show_state?: boolean;
  theme?: string;
}

export interface EntityButtonCardConfig extends BaseCardConfig, ActionableConfig {
  type: "entity-button";
  entity: string;
  name?: string;
  icon?: string;
  show_name?: boolean;
  show_icon?: boolean;
}

export interface GlanceCardConfig extends BaseCardConfig {
  type: "glance";
  entities: (string | GlanceEntity)[];
  title?: string;
  show_name?: boolean;
  show_state?: boolean;
  show_icon?: boolean;
  state_color?: boolean;
  columns?: number;
  theme?: string;
}

export interface GlanceEntity extends ActionableConfig {
  entity: string;
  name?: string;
  icon?: string;
  image?: string;
  show_name?: boolean;
  show_state?: boolean;
  show_icon?: boolean;
  state_color?: boolean;
}

export interface GridCardConfig extends BaseCardConfig {
  type: "grid";
  cards: LovelaceCardConfig[];
  columns?: number;
  square?: boolean;
  title?: string;
}

export interface SectionCardConfig extends BaseCardConfig {
  type: "section";
  cards?: LovelaceCardConfig[];
  title?: string;
  column_span?: number;
}

export interface LightCardConfig extends BaseCardConfig, ActionableConfig {
  type: "light";
  entity: string;
  name?: string;
  icon?: string;
  theme?: string;
}

export interface SensorCardConfig extends BaseCardConfig {
  type: "sensor";
  entity: string;
  name?: string;
  icon?: string;
  graph?: "line" | "none";
  unit?: string;
  detail?: number;
  hours_to_show?: number;
  limits?: { min?: number; max?: number };
  theme?: string;
}

export interface ThermostatCardConfig extends BaseCardConfig {
  type: "thermostat";
  entity: string;
  name?: string;
  theme?: string;
  features?: LovelaceCardFeatureConfig[];
}

export interface WeatherForecastCardConfig extends BaseCardConfig, ActionableConfig {
  type: "weather-forecast";
  entity: string;
  name?: string;
  show_current?: boolean;
  show_forecast?: boolean;
  forecast_type?: "daily" | "hourly" | "twice_daily";
  secondary_info_attribute?: string;
  theme?: string;
}

export interface EntityCardConfig extends BaseCardConfig {
  type: "entity";
  entity: string;
  name?: string;
  icon?: string;
  attribute?: string;
  unit?: string;
  state_color?: boolean;
  theme?: string;
  header?: LovelaceHeaderFooterConfig;
  footer?: LovelaceHeaderFooterConfig;
}

export interface HeadingCardConfig extends BaseCardConfig, ActionableConfig {
  type: "heading";
  heading?: string;
  heading_style?: "title" | "subtitle";
  icon?: string;
  badges?: LovelaceBadgeConfig[];
}

// --- P1: Lazy loaded ---

export interface AlarmPanelCardConfig extends BaseCardConfig {
  type: "alarm-panel";
  entity: string;
  name?: string;
  states?: string[];
  theme?: string;
}

export interface AreaCardConfig extends BaseCardConfig, ActionableConfig {
  type: "area";
  area: string;
  name?: string;
  show_camera?: boolean;
  camera_view?: "auto" | "live";
  features?: LovelaceCardFeatureConfig[];
  alert_classes?: string[];
  sensor_classes?: string[];
}

export interface CalendarCardConfig extends BaseCardConfig {
  type: "calendar";
  entities: string[];
  initial_view?: "dayGridMonth" | "dayGridWeek" | "dayGridDay" | "listWeek";
  theme?: string;
}

export interface ConditionalCardConfig extends BaseCardConfig {
  type: "conditional";
  conditions: (VisibilityCondition | LegacyCondition)[];
  card: LovelaceCardConfig;
}

export interface EmptyStateCardConfig extends BaseCardConfig {
  type: "empty-state";
  title?: string;
  content?: string;
  icon?: string;
}

export interface EntityFilterCardConfig extends BaseCardConfig {
  type: "entity-filter";
  entities: (string | LovelaceRowConfig)[];
  state_filter?: (string | { key: string; operator: string; value: string })[];
  conditions?: VisibilityCondition[];
  card?: Partial<LovelaceCardConfig>;
  show_empty?: boolean;
}

export interface ErrorCardConfig extends BaseCardConfig {
  type: "error";
  error: string;
  origConfig?: LovelaceCardConfig;
}

export interface GaugeCardConfig extends BaseCardConfig {
  type: "gauge";
  entity: string;
  name?: string;
  icon?: string;
  unit?: string;
  min?: number;
  max?: number;
  severity?: {
    green?: number;
    yellow?: number;
    red?: number;
  };
  needle?: boolean;
  theme?: string;
}

export interface HistoryGraphCardConfig extends BaseCardConfig {
  type: "history-graph";
  entities: (string | { entity: string; name?: string })[];
  hours_to_show?: number;
  title?: string;
  show_names?: boolean;
  logarithmic_scale?: boolean;
  min_y_axis?: number;
  max_y_axis?: number;
  fit_y_data?: boolean;
}

export interface HorizontalStackCardConfig extends BaseCardConfig {
  type: "horizontal-stack";
  cards: LovelaceCardConfig[];
  title?: string;
}

export interface VerticalStackCardConfig extends BaseCardConfig {
  type: "vertical-stack";
  cards: LovelaceCardConfig[];
  title?: string;
}

export interface DistributionCardConfig extends BaseCardConfig {
  type: "distribution";
  // Distribution card config details are complex; keep open-ended.
  [key: string]: unknown;
}

export interface HumidifierCardConfig extends BaseCardConfig {
  type: "humidifier";
  entity: string;
  name?: string;
  theme?: string;
  features?: LovelaceCardFeatureConfig[];
}

export interface IframeCardConfig extends BaseCardConfig {
  type: "iframe";
  url: string;
  title?: string;
  aspect_ratio?: string;
  allow_open_top_navigation?: boolean;
}

export interface LogbookCardConfig extends BaseCardConfig {
  type: "logbook";
  entities?: string[];
  title?: string;
  hours_to_show?: number;
  theme?: string;
}

export interface MapCardConfig extends BaseCardConfig {
  type: "map";
  entities?: (string | { entity: string })[];
  geo_location_sources?: string[];
  title?: string;
  aspect_ratio?: string;
  default_zoom?: number;
  dark_mode?: boolean;
  hours_to_show?: number;
  theme_mode?: "auto" | "light" | "dark";
}

export interface MarkdownCardConfig extends BaseCardConfig {
  type: "markdown";
  content: string;
  title?: string;
  card_size?: number;
  entity_id?: string | string[];
  theme?: string;
}

export interface ClockCardConfig extends BaseCardConfig {
  type: "clock";
  clock_size?: "small" | "medium" | "large";
  display?: "12h" | "24h";
}

export interface MediaControlCardConfig extends BaseCardConfig {
  type: "media-control";
  entity: string;
  theme?: string;
}

export interface PictureCardConfig extends BaseCardConfig, ActionableConfig {
  type: "picture";
  image?: string;
  image_entity?: string;
  alt_text?: string;
  theme?: string;
}

export interface PictureElementsCardConfig extends BaseCardConfig {
  type: "picture-elements";
  image?: string;
  camera_image?: string;
  camera_view?: "auto" | "live";
  state_image?: Record<string, string>;
  state_filter?: Record<string, string>;
  aspect_ratio?: string;
  entity?: string;
  elements: LovelaceElementConfig[];
  theme?: string;
  dark_mode_image?: string;
  dark_mode_filter?: string;
}

export interface PictureEntityCardConfig extends BaseCardConfig, ActionableConfig {
  type: "picture-entity";
  entity: string;
  image?: string;
  camera_image?: string;
  camera_view?: "auto" | "live";
  state_image?: Record<string, string>;
  state_filter?: Record<string, string>;
  aspect_ratio?: string;
  name?: string;
  show_name?: boolean;
  show_state?: boolean;
  theme?: string;
}

export interface PictureGlanceCardConfig extends BaseCardConfig, ActionableConfig {
  type: "picture-glance";
  entities: (string | GlanceEntity)[];
  image?: string;
  camera_image?: string;
  camera_view?: "auto" | "live";
  state_image?: Record<string, string>;
  state_filter?: Record<string, string>;
  aspect_ratio?: string;
  title?: string;
  entity?: string;
  theme?: string;
}

export interface PlantStatusCardConfig extends BaseCardConfig {
  type: "plant-status";
  entity: string;
  name?: string;
  theme?: string;
}

export interface RecoveryModeCardConfig extends BaseCardConfig {
  type: "recovery-mode";
}

export interface StartingCardConfig extends BaseCardConfig {
  type: "starting";
}

export interface StatisticCardConfig extends BaseCardConfig {
  type: "statistic";
  entity: string;
  name?: string;
  stat_type?: "min" | "max" | "mean" | "sum" | "state" | "change";
  period?: { calendar?: { period: string }; rolling_window?: { duration: Record<string, number> } };
  theme?: string;
}

export interface StatisticsGraphCardConfig extends BaseCardConfig {
  type: "statistics-graph";
  entities: (string | { entity: string; name?: string })[];
  title?: string;
  days_to_show?: number;
  period?: "5minute" | "hour" | "day" | "week" | "month";
  stat_types?: ("min" | "max" | "mean" | "sum" | "state" | "change")[];
  chart_type?: "line" | "bar";
  hide_legend?: boolean;
  logarithmic_scale?: boolean;
}

export interface TodoListCardConfig extends BaseCardConfig {
  type: "todo-list";
  entity: string;
  title?: string;
  theme?: string;
}

export interface ShoppingListCardConfig extends BaseCardConfig {
  type: "shopping-list";
  title?: string;
  theme?: string;
}

export interface ShortcutCardConfig extends BaseCardConfig, ActionableConfig {
  type: "shortcut";
  name?: string;
  icon?: string;
}

export interface ToggleGroupCardConfig extends BaseCardConfig {
  type: "toggle-group";
  entities: string[];
  hide_when_off?: boolean;
}

export interface HomeSummaryCardConfig extends BaseCardConfig {
  type: "home-summary";
}

export interface DiscoveredDevicesCardConfig extends BaseCardConfig {
  type: "discovered-devices";
}

export interface RepairsCardConfig extends BaseCardConfig {
  type: "repairs";
}

export interface AlertCardConfig extends BaseCardConfig {
  type: "alert";
}

export interface UpdatesCardConfig extends BaseCardConfig {
  type: "updates";
}

// --- Energy cards ---

export interface EnergyUsageGraphCardConfig extends BaseCardConfig {
  type: "energy-usage-graph";
  collection_key?: string;
}

export interface EnergyDistributionCardConfig extends BaseCardConfig {
  type: "energy-distribution";
  link_dashboard?: boolean;
  collection_key?: string;
}

export interface EnergySankeyCardConfig extends BaseCardConfig {
  type: "energy-sankey";
  collection_key?: string;
}

export interface EnergyDateSelectionCardConfig extends BaseCardConfig {
  type: "energy-date-selection";
  collection_key?: string;
}

export interface EnergyDevicesGraphCardConfig extends BaseCardConfig {
  type: "energy-devices-graph";
  collection_key?: string;
  max_devices?: number;
}

export interface EnergyDevicesDetailGraphCardConfig extends BaseCardConfig {
  type: "energy-devices-detail-graph";
  collection_key?: string;
}

export interface EnergySourcesTableCardConfig extends BaseCardConfig {
  type: "energy-sources-table";
  collection_key?: string;
}

export interface EnergySolarGraphCardConfig extends BaseCardConfig {
  type: "energy-solar-graph";
  collection_key?: string;
}

export interface EnergyGasGraphCardConfig extends BaseCardConfig {
  type: "energy-gas-graph";
  collection_key?: string;
}

export interface EnergyWaterGraphCardConfig extends BaseCardConfig {
  type: "energy-water-graph";
  collection_key?: string;
}

export interface EnergyCarbonConsumedGaugeCardConfig extends BaseCardConfig {
  type: "energy-carbon-consumed-gauge";
  collection_key?: string;
}

export interface EnergyGridNeutralityGaugeCardConfig extends BaseCardConfig {
  type: "energy-grid-neutrality-gauge";
  collection_key?: string;
}

export interface EnergyGridBalanceCardConfig extends BaseCardConfig {
  type: "energy-grid-balance";
  collection_key?: string;
}

export interface EnergySolarConsumedGaugeCardConfig extends BaseCardConfig {
  type: "energy-solar-consumed-gauge";
  collection_key?: string;
}

export interface EnergySelfSufficiencyGaugeCardConfig extends BaseCardConfig {
  type: "energy-self-sufficiency-gauge";
  collection_key?: string;
}

export interface EnergyCompareCardConfig extends BaseCardConfig {
  type: "energy-compare";
  collection_key?: string;
}

export interface WaterSankeyCardConfig extends BaseCardConfig {
  type: "water-sankey";
  collection_key?: string;
}

export interface WaterFlowSankeyCardConfig extends BaseCardConfig {
  type: "water-flow-sankey";
  collection_key?: string;
}

export interface PowerSourcesGraphCardConfig extends BaseCardConfig {
  type: "power-sources-graph";
  collection_key?: string;
}

export interface PowerSankeyCardConfig extends BaseCardConfig {
  type: "power-sankey";
  collection_key?: string;
}

// --- Union type ---

export type LovelaceCardConfig =
  | TileCardConfig
  | EntitiesCardConfig
  | ButtonCardConfig
  | EntityButtonCardConfig
  | GlanceCardConfig
  | GridCardConfig
  | SectionCardConfig
  | LightCardConfig
  | SensorCardConfig
  | ThermostatCardConfig
  | WeatherForecastCardConfig
  | EntityCardConfig
  | HeadingCardConfig
  | AlarmPanelCardConfig
  | AreaCardConfig
  | CalendarCardConfig
  | ConditionalCardConfig
  | EmptyStateCardConfig
  | EntityFilterCardConfig
  | ErrorCardConfig
  | GaugeCardConfig
  | HistoryGraphCardConfig
  | HorizontalStackCardConfig
  | VerticalStackCardConfig
  | DistributionCardConfig
  | HumidifierCardConfig
  | IframeCardConfig
  | LogbookCardConfig
  | MapCardConfig
  | MarkdownCardConfig
  | ClockCardConfig
  | MediaControlCardConfig
  | PictureCardConfig
  | PictureElementsCardConfig
  | PictureEntityCardConfig
  | PictureGlanceCardConfig
  | PlantStatusCardConfig
  | RecoveryModeCardConfig
  | StartingCardConfig
  | StatisticCardConfig
  | StatisticsGraphCardConfig
  | TodoListCardConfig
  | ShoppingListCardConfig
  | ShortcutCardConfig
  | ToggleGroupCardConfig
  | HomeSummaryCardConfig
  | DiscoveredDevicesCardConfig
  | RepairsCardConfig
  | AlertCardConfig
  | UpdatesCardConfig
  | EnergyUsageGraphCardConfig
  | EnergyDistributionCardConfig
  | EnergySankeyCardConfig
  | EnergyDateSelectionCardConfig
  | EnergyDevicesGraphCardConfig
  | EnergyDevicesDetailGraphCardConfig
  | EnergySourcesTableCardConfig
  | EnergySolarGraphCardConfig
  | EnergyGasGraphCardConfig
  | EnergyWaterGraphCardConfig
  | EnergyCarbonConsumedGaugeCardConfig
  | EnergyGridNeutralityGaugeCardConfig
  | EnergyGridBalanceCardConfig
  | EnergySolarConsumedGaugeCardConfig
  | EnergySelfSufficiencyGaugeCardConfig
  | EnergyCompareCardConfig
  | WaterSankeyCardConfig
  | WaterFlowSankeyCardConfig
  | PowerSourcesGraphCardConfig
  | PowerSankeyCardConfig;

/** All known card type strings. */
export const CARD_TYPES = [
  "tile",
  "entities",
  "button",
  "entity-button",
  "glance",
  "grid",
  "section",
  "light",
  "sensor",
  "thermostat",
  "weather-forecast",
  "entity",
  "heading",
  "alarm-panel",
  "area",
  "calendar",
  "conditional",
  "empty-state",
  "entity-filter",
  "error",
  "gauge",
  "history-graph",
  "horizontal-stack",
  "vertical-stack",
  "distribution",
  "humidifier",
  "iframe",
  "logbook",
  "map",
  "markdown",
  "clock",
  "media-control",
  "picture",
  "picture-elements",
  "picture-entity",
  "picture-glance",
  "plant-status",
  "recovery-mode",
  "starting",
  "statistic",
  "statistics-graph",
  "todo-list",
  "shopping-list",
  "shortcut",
  "toggle-group",
  "home-summary",
  "discovered-devices",
  "repairs",
  "alert",
  "updates",
  "energy-usage-graph",
  "energy-distribution",
  "energy-sankey",
  "energy-date-selection",
  "energy-devices-graph",
  "energy-devices-detail-graph",
  "energy-sources-table",
  "energy-solar-graph",
  "energy-gas-graph",
  "energy-water-graph",
  "energy-carbon-consumed-gauge",
  "energy-grid-neutrality-gauge",
  "energy-grid-balance",
  "energy-solar-consumed-gauge",
  "energy-self-sufficiency-gauge",
  "energy-compare",
  "water-sankey",
  "water-flow-sankey",
  "power-sources-graph",
  "power-sankey",
] as const;

export type CardType = (typeof CARD_TYPES)[number];
