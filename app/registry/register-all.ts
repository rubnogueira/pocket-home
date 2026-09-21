/**
 * Register all implemented cards, features, badges, and rows.
 * Call this once at app startup before rendering.
 */

import { registerCard } from "./card-registry.ts";
import { registerFeature } from "./feature-registry.ts";
import { registerBadge } from "./badge-registry.ts";
import { registerRow } from "./row-registry.ts";

// --- P0 Cards ---
import TileCard from "../cards/TileCard.tsx";
import EntitiesCard from "../cards/EntitiesCard.tsx";
import ButtonCard from "../cards/ButtonCard.tsx";
import EntityCard from "../cards/EntityCard.tsx";
import GlanceCard from "../cards/GlanceCard.tsx";
import GridCard from "../cards/GridCard.tsx";
import HeadingCard from "../cards/HeadingCard.tsx";
import LightCard from "../cards/LightCard.tsx";
import SensorCard from "../cards/SensorCard.tsx";
import ThermostatCard from "../cards/ThermostatCard.tsx";
import WeatherForecastCard from "../cards/WeatherForecastCard.tsx";
import SectionCard from "../cards/SectionCard.tsx";
import AreaCard from "../cards/AreaCard.tsx";

// --- P1 Cards ---
import AlarmPanelCard from "../cards/AlarmPanelCard.tsx";
import CalendarCard from "../cards/CalendarCard.tsx";
import ClockCard from "../cards/ClockCard.tsx";
import ConditionalCard from "../cards/ConditionalCard.tsx";
import EntityFilterCard from "../cards/EntityFilterCard.tsx";
import GaugeCard from "../cards/GaugeCard.tsx";
import HistoryGraphCard from "../cards/HistoryGraphCard.tsx";
import HorizontalStackCard from "../cards/HorizontalStackCard.tsx";
import VerticalStackCard from "../cards/VerticalStackCard.tsx";
import MarkdownCard from "../cards/MarkdownCard.tsx";
import MediaControlCard from "../cards/MediaControlCard.tsx";
import StatisticCard from "../cards/StatisticCard.tsx";
import TodoListCard from "../cards/TodoListCard.tsx";
import ShortcutCard from "../cards/ShortcutCard.tsx";

// --- Features ---
import ToggleFeature from "../features/ToggleFeature.tsx";
import BrightnessFeature from "../features/BrightnessFeature.tsx";
import ColorTempFeature from "../features/ColorTempFeature.tsx";
import TargetTempFeature from "../features/TargetTempFeature.tsx";
import HvacModesFeature from "../features/HvacModesFeature.tsx";
import CoverPositionFeature from "../features/CoverPositionFeature.tsx";
import MediaPlaybackFeature from "../features/MediaPlaybackFeature.tsx";
import VolumeSliderFeature from "../features/VolumeSliderFeature.tsx";
import LockCommandsFeature from "../features/LockCommandsFeature.tsx";
import SelectOptionsFeature from "../features/SelectOptionsFeature.tsx";
import NumericInputFeature from "../features/NumericInputFeature.tsx";
import AlarmModesFeature from "../features/AlarmModesFeature.tsx";
import CoverOpenCloseFeature from "../features/CoverOpenCloseFeature.tsx";

// --- Badges ---
import EntityBadge from "../badges/EntityBadge.tsx";
import ShortcutBadge from "../badges/ShortcutBadge.tsx";

// --- Rows ---
import SimpleEntityRow from "../rows/SimpleEntityRow.tsx";
import ToggleEntityRow from "../rows/ToggleEntityRow.tsx";
import SensorEntityRow from "../rows/SensorEntityRow.tsx";
import ButtonRow from "../rows/ButtonRow.tsx";
import DividerRow from "../rows/DividerRow.tsx";
import SectionRow from "../rows/SectionRow.tsx";
import ClimateEntityRow from "../rows/ClimateEntityRow.tsx";
import MediaPlayerEntityRow from "../rows/MediaPlayerEntityRow.tsx";
import CoverEntityRow from "../rows/CoverEntityRow.tsx";
import LockEntityRow from "../rows/LockEntityRow.tsx";
import SceneEntityRow from "../rows/SceneEntityRow.tsx";

export function registerAll(): void {
  // P0 cards
  registerCard("tile", TileCard);
  registerCard("entities", EntitiesCard);
  registerCard("button", ButtonCard);
  registerCard("entity-button", ButtonCard);
  registerCard("entity", EntityCard);
  registerCard("glance", GlanceCard);
  registerCard("grid", GridCard);
  registerCard("heading", HeadingCard);
  registerCard("light", LightCard);
  registerCard("sensor", SensorCard);
  registerCard("thermostat", ThermostatCard);
  registerCard("weather-forecast", WeatherForecastCard);
  registerCard("section", SectionCard);
  registerCard("area", AreaCard);

  // P1 cards
  registerCard("alarm-panel", AlarmPanelCard);
  registerCard("calendar", CalendarCard);
  registerCard("clock", ClockCard);
  registerCard("conditional", ConditionalCard);
  registerCard("entity-filter", EntityFilterCard);
  registerCard("gauge", GaugeCard);
  registerCard("history-graph", HistoryGraphCard);
  registerCard("horizontal-stack", HorizontalStackCard);
  registerCard("vertical-stack", VerticalStackCard);
  registerCard("markdown", MarkdownCard);
  registerCard("media-control", MediaControlCard);
  registerCard("statistic", StatisticCard);
  registerCard("todo-list", TodoListCard);
  registerCard("shortcut", ShortcutCard);

  // Features
  registerFeature("toggle", ToggleFeature);
  registerFeature("light-brightness", BrightnessFeature);
  registerFeature("light-color-temp", ColorTempFeature);
  registerFeature("target-temperature", TargetTempFeature);
  registerFeature("climate-hvac-modes", HvacModesFeature);
  registerFeature("cover-position", CoverPositionFeature);
  registerFeature("cover-open-close", CoverOpenCloseFeature);
  registerFeature("media-player-playback", MediaPlaybackFeature);
  registerFeature("media-player-volume-slider", VolumeSliderFeature);
  registerFeature("lock-commands", LockCommandsFeature);
  registerFeature("select-options", SelectOptionsFeature);
  registerFeature("numeric-input", NumericInputFeature);
  registerFeature("alarm-modes", AlarmModesFeature);

  // Badges
  registerBadge("entity", EntityBadge);
  registerBadge("shortcut", ShortcutBadge);

  // Rows
  registerRow("simple-entity", SimpleEntityRow);
  registerRow("toggle-entity", ToggleEntityRow);
  registerRow("sensor-entity", SensorEntityRow);
  registerRow("button", ButtonRow);
  registerRow("button-entity", ButtonRow);
  registerRow("divider", DividerRow);
  registerRow("section", SectionRow);
  registerRow("climate-entity", ClimateEntityRow);
  registerRow("media-player-entity", MediaPlayerEntityRow);
  registerRow("cover-entity", CoverEntityRow);
  registerRow("lock-entity", LockEntityRow);
  registerRow("scene-entity", SceneEntityRow);
  registerRow("script-entity", ButtonRow);
  registerRow("input-button-entity", ButtonRow);
}
