/**
 * Home Assistant demo seed — stand-in until a real instance API feeds the store.
 *
 * Source: https://demo.home-assistant.io/
 * Static snapshot aligned with the HA frontend demo (sections variant):
 *   github.com/home-assistant/frontend  demo/src/configs/sections/entities.ts
 *   github.com/home-assistant/frontend  demo/src/configs/sections/lovelace.ts
 */

import type { HassEntity } from "../types/entity.ts";
import type { LovelaceDashboardConfig } from "../types/dashboard.ts";

/** Public demo instance this seed replicates (future REST/WebSocket base URL). */
export const HOME_ASSISTANT_DEMO_URL = "https://demo.home-assistant.io";

function mkEntity(entity_id: string, state: string, attrs: Record<string, unknown>): HassEntity {
  const now = new Date().toISOString();
  return {
    entity_id,
    state,
    attributes: { ...attrs },
    last_changed: now,
    last_updated: now,
    context: { id: entity_id, parent_id: null, user_id: null },
  };
}

function mediaPosUpdatedAt(): string {
  return new Date(Date.now() - 23000).toISOString();
}

// ---------------------------------------------------------------------------
// Entities — exact match of HA frontend demo sections/entities.ts
// ---------------------------------------------------------------------------

export const DEMO_ENTITIES: HassEntity[] = [
  // ── Living room ──────────────────────────────────────────────────
  mkEntity("cover.living_room_garden_shutter", "open", {
    current_position: 100,
    device_class: "shutter",
    friendly_name: "Living room garden shutter",
    supported_features: 15,
  }),
  mkEntity("cover.living_room_graveyard_shutter", "open", {
    current_position: 100,
    device_class: "shutter",
    friendly_name: "Living room graveyard shutter",
    supported_features: 15,
  }),
  mkEntity("cover.living_room_left_shutter", "open", {
    current_position: 100,
    device_class: "shutter",
    friendly_name: "Living room left shutter",
    supported_features: 15,
  }),
  mkEntity("cover.living_room_right_shutter", "open", {
    current_position: 100,
    device_class: "shutter",
    friendly_name: "Living room right shutter",
    supported_features: 15,
  }),
  mkEntity("light.floor_lamp", "on", {
    min_color_temp_kelvin: 2000,
    max_color_temp_kelvin: 6535,
    min_mireds: 153,
    max_mireds: 500,
    supported_color_modes: ["color_temp", "xy"],
    color_mode: "color_temp",
    brightness: 178,
    color_temp_kelvin: 2583,
    color_temp: 387,
    hs_color: [28.664, 69.597],
    rgb_color: [255, 162, 77],
    xy_color: [0.538, 0.389],
    icon: "mdi:floor-lamp",
    friendly_name: "Floor lamp",
    supported_features: 44,
  }),
  mkEntity("light.living_room_spotlights", "on", {
    supported_color_modes: ["brightness"],
    color_mode: "brightness",
    brightness: 126,
    icon: "mdi:ceiling-light-multiple",
    friendly_name: "Living room spotlights",
    supported_features: 32,
  }),
  mkEntity("light.bar_lamp", "on", {
    min_color_temp_kelvin: 2202,
    max_color_temp_kelvin: 4504,
    min_mireds: 222,
    max_mireds: 454,
    effect_list: ["None", "candle"],
    supported_color_modes: ["color_temp"],
    effect: null,
    color_mode: null,
    brightness: null,
    color_temp_kelvin: null,
    color_temp: null,
    hs_color: null,
    rgb_color: null,
    xy_color: null,
    mode: "normal",
    dynamics: "none",
    icon: "mdi:lightbulb-variant",
    friendly_name: "Bar lamp",
    supported_features: 44,
  }),
  mkEntity("sensor.living_room_temperature", "22.8", {
    state_class: "measurement",
    unit_of_measurement: "\u00b0C",
    device_class: "temperature",
    friendly_name: "Living room Temperature",
  }),
  mkEntity("sensor.living_room_humidity", "57", {
    state_class: "measurement",
    unit_of_measurement: "%",
    device_class: "humidity",
    friendly_name: "Living room Humidity",
  }),

  // ── Outdoor / general sensors ────────────────────────────────────
  mkEntity("sensor.outdoor_temperature", "10.5", {
    state_class: "measurement",
    unit_of_measurement: "\u00b0C",
    device_class: "temperature",
    friendly_name: "Outdoor temperature",
  }),
  mkEntity("sensor.outdoor_humidity", "70.4", {
    state_class: "measurement",
    unit_of_measurement: "%",
    device_class: "humidity",
    friendly_name: "Outdoor humidity",
  }),
  mkEntity("device_tracker.car", "not_home", {
    friendly_name: "Car",
    icon: "mdi:car",
  }),

  // ── Living room media ────────────────────────────────────────────
  mkEntity("media_player.living_room_nest_mini", "playing", {
    device_class: "speaker",
    volume_level: 0.18,
    is_volume_muted: false,
    media_content_type: "music",
    media_duration: 300,
    media_position: 0,
    media_position_updated_at: mediaPosUpdatedAt(),
    media_title: "I Wasn\u2019t Born To Follow",
    media_artist: "The Byrds",
    media_album_name: "The Notorious Byrd Brothers",
    source_list: ["It's A Party", "Radio HSL", "Retro 70s and 80s"],
    shuffle: false,
    night_sound: false,
    speech_enhance: false,
    friendly_name: "Living Room Nest Mini",
    entity_picture: "/assets/sections/images/media_player_family_room.jpg",
    supported_features: 64063,
  }),

  // ── Kitchen ──────────────────────────────────────────────────────
  mkEntity("cover.kitchen_shutter", "open", {
    current_position: 100,
    device_class: "shutter",
    friendly_name: "Kitchen shutter",
    supported_features: 15,
  }),
  mkEntity("light.kitchen_spotlights", "off", {
    supported_color_modes: ["brightness"],
    color_mode: null,
    brightness: null,
    icon: "mdi:ceiling-light-multiple",
    friendly_name: "Kitchen spotlights",
    supported_features: 32,
  }),
  mkEntity("binary_sensor.kitchen_motion", "on", {
    device_class: "motion",
    friendly_name: "Kitchen motion",
  }),
  mkEntity("light.worktop_spotlights", "off", {
    supported_color_modes: ["brightness"],
    color_mode: null,
    brightness: null,
    icon: "mdi:ceiling-light-multiple",
    friendly_name: "Worktop spotlights",
    supported_features: 32,
  }),
  mkEntity("binary_sensor.fridge_door", "off", {
    device_class: "door",
    icon: "mdi:fridge",
    friendly_name: "Fridge door",
  }),
  mkEntity("media_player.kitchen_nest_audio", "on", {
    device_class: "speaker",
    volume_level: 0.18,
    is_volume_muted: false,
    media_content_type: "music",
    media_duration: 300,
    media_position: 0,
    media_position_updated_at: mediaPosUpdatedAt(),
    media_title: "I Wasn\u2019t Born To Follow",
    media_artist: "The Byrds",
    media_album_name: "The Notorious Byrd Brothers",
    source_list: ["It's A Party", "Radio HSL", "Retro 70s and 80s"],
    shuffle: false,
    night_sound: false,
    speech_enhance: false,
    friendly_name: "Kitchen Nest Audio",
    entity_picture: "/assets/sections/images/media_player_family_room.jpg",
    supported_features: 64063,
  }),

  // ── Energy ───────────────────────────────────────────────────────
  mkEntity("binary_sensor.tesla_wall_connector_vehicle_connected", "off", {
    device_class: "plug",
    friendly_name: "Wall Connector Vehicle connected",
  }),
  mkEntity("sensor.tesla_wall_connector_session_energy", "16.3", {
    state_class: "total_increasing",
    unit_of_measurement: "kWh",
    device_class: "energy",
    friendly_name: "Tesla Wall Connector Session energy",
  }),
  mkEntity("sensor.electric_meter_power", "797.86", {
    state_class: "measurement",
    unit_of_measurement: "W",
    device_class: "power",
    icon: "mdi:meter-electric",
    friendly_name: "Electric meter Power",
  }),
  mkEntity("sensor.eletric_meter_voltage", "232.19", {
    state_class: "measurement",
    unit_of_measurement: "V",
    device_class: "voltage",
    friendly_name: "Electric meter voltage",
  }),
  mkEntity("sensor.electricity_maps_grid_fossil_fuel_percentage", "9.84", {
    state_class: "measurement",
    country_code: "FR",
    unit_of_measurement: "%",
    attribution: "Data provided by Electricity Maps",
    icon: "mdi:barrel",
    friendly_name: "Electricity Maps Grid fossil fuel percentage",
  }),
  mkEntity("sensor.electricity_maps_co2_intensity", "62.0", {
    state_class: "measurement",
    country_code: "FR",
    unit_of_measurement: "gCO2eq/kWh",
    attribution: "Data provided by Electricity Maps",
    friendly_name: "Electricity Maps CO2 intensity",
    icon: "mdi:molecule-co2",
  }),

  // ── Climate ──────────────────────────────────────────────────────
  mkEntity("sun.sun", "above_horizon", {
    next_dawn: "2024-03-05T05:50:21.964405+00:00",
    next_dusk: "2024-03-04T18:08:54.311334+00:00",
    next_midnight: "2024-03-05T00:00:00+00:00",
    next_noon: "2024-03-05T12:00:05+00:00",
    next_rising: "2024-03-05T06:23:42.739159+00:00",
    next_setting: "2024-03-04T17:35:26.271171+00:00",
    elevation: 30.38,
    azimuth: 204.42,
    rising: false,
    friendly_name: "Sun",
  }),
  mkEntity("sensor.rain", "7.2", {
    state_class: "total_increasing",
    unit_of_measurement: "mm",
    device_class: "precipitation",
    friendly_name: "Rain",
  }),
  mkEntity("climate.ground_floor", "heat", {
    hvac_modes: ["auto", "heat", "off"],
    min_temp: 7,
    max_temp: 35,
    preset_modes: ["comfort", "away", "eco", "frost_protection", "external", "home"],
    current_temperature: 20.8,
    temperature: 21,
    preset_mode: "comfort",
    icon: "mdi:home-floor-0",
    friendly_name: "Ground floor Thermostat",
    supported_features: 401,
  }),
  mkEntity("climate.first_floor", "heat", {
    hvac_modes: ["auto", "heat", "off"],
    min_temp: 7,
    max_temp: 35,
    preset_modes: ["comfort", "away", "eco", "frost_protection", "external", "home"],
    current_temperature: 21.7,
    temperature: 21,
    preset_mode: "comfort",
    icon: "mdi:home-floor-1",
    friendly_name: "First floor Thermostat",
    supported_features: 401,
  }),

  // ── Study ────────────────────────────────────────────────────────
  mkEntity("cover.study_shutter", "open", {
    current_position: 100,
    device_class: "shutter",
    friendly_name: "Study shutter",
    supported_features: 15,
  }),
  mkEntity("light.study_spotlights", "off", {
    supported_color_modes: ["brightness"],
    color_mode: null,
    brightness: null,
    icon: "mdi:ceiling-light-multiple",
    friendly_name: "Study spotlights",
    supported_features: 32,
  }),
  mkEntity("media_player.study_nest_hub", "off", {
    device_class: "speaker",
    volume_level: 0.18,
    is_volume_muted: false,
    media_content_type: "music",
    media_duration: 300,
    media_position: 0,
    media_position_updated_at: mediaPosUpdatedAt(),
    media_title: "I Wasn\u2019t Born To Follow",
    media_artist: "The Byrds",
    media_album_name: "The Notorious Byrd Brothers",
    source_list: ["It's A Party", "Radio HSL", "Retro 70s and 80s"],
    shuffle: false,
    night_sound: false,
    speech_enhance: false,
    friendly_name: "Study Nest Hub",
    entity_picture: "/assets/sections/images/media_player_family_room.jpg",
    supported_features: 64063,
  }),
  mkEntity("switch.in_meeting", "on", {
    icon: "mdi:laptop-account",
    friendly_name: "In a meeting",
  }),
  mkEntity("sensor.standing_desk_height", "72", {
    unit_of_measurement: "cm",
    icon: "mdi:tape-measure",
    friendly_name: "Standing desk Height",
  }),

  // ── Outdoor ──────────────────────────────────────────────────────
  mkEntity("light.outdoor_light", "on", {
    supported_color_modes: ["brightness"],
    color_mode: null,
    brightness: 255,
    icon: "mdi:outdoor-lamp",
    friendly_name: "Outdoor light",
    supported_features: 32,
  }),
  mkEntity("light.flood_light", "off", {
    effect_list: ["None", "candle"],
    supported_color_modes: ["brightness"],
    effect: null,
    color_mode: null,
    brightness: null,
    mode: "normal",
    dynamics: "none",
    icon: "mdi:light-flood-down",
    friendly_name: "Flood light",
    supported_features: 44,
  }),
  mkEntity("sensor.outdoor_motion_sensor_temperature", "10.2", {
    state_class: "measurement",
    unit_of_measurement: "\u00b0C",
    device_class: "temperature",
    friendly_name: "Outdoor motion sensor Temperature",
  }),
  mkEntity("binary_sensor.outdoor_motion_sensor_motion", "off", {
    device_class: "motion",
    friendly_name: "Outdoor motion sensor Motion",
  }),
  mkEntity("sensor.outdoor_motion_sensor_illuminance", "555", {
    state_class: "measurement",
    light_level: 27444,
    unit_of_measurement: "lx",
    device_class: "illuminance",
    friendly_name: "Outdoor motion sensor Illuminance",
  }),

  // ── Updates / automations ────────────────────────────────────────
  mkEntity("automation.home_assistant_auto_update", "off", {
    id: "1700669321947",
    last_triggered: "2024-02-29T18:02:05.343139+00:00",
    mode: "queued",
    current: 0,
    max: 50,
    icon: "mdi:auto-mode",
    friendly_name: "Home Assistant Auto-update",
  }),
  mkEntity("update.home_assistant_operating_system_update", "off", {
    auto_update: false,
    installed_version: "12.1",
    in_progress: false,
    latest_version: "12.1",
    release_summary: null,
    release_url: "https://github.com/home-assistant/operating-system/commits/dev",
    skipped_version: null,
    title: "Home Assistant Operating System",
    entity_picture: "https://brands.home-assistant.io/homeassistant/icon.png",
    friendly_name: "Home Assistant Operating System Update",
    supported_features: 3,
  }),
  mkEntity("update.home_assistant_supervisor_update", "off", {
    auto_update: true,
    installed_version: "2024.02.2",
    in_progress: false,
    latest_version: "2024.02.2",
    release_summary: null,
    release_url: "https://github.com/home-assistant/supervisor/commits/main",
    skipped_version: null,
    title: "Home Assistant Supervisor",
    entity_picture: "https://brands.home-assistant.io/hassio/icon.png",
    friendly_name: "Home Assistant Supervisor Update",
    supported_features: 1,
  }),
  mkEntity("update.home_assistant_core_update", "off", {
    auto_update: false,
    installed_version: "2024.4.0",
    in_progress: false,
    latest_version: "2024.4.0",
    release_summary: null,
    release_url: "https://github.com/home-assistant/core/commits/dev",
    skipped_version: null,
    title: "Home Assistant Core",
    entity_picture: "https://brands.home-assistant.io/homeassistant/icon.png",
    friendly_name: "Home Assistant Core Update",
    supported_features: 11,
  }),
];

// ---------------------------------------------------------------------------
// Dashboard — exact match of HA frontend demo sections/lovelace.ts
// ---------------------------------------------------------------------------

export const DEMO_DASHBOARD: LovelaceDashboardConfig = {
  title: "Home Assistant Demo",
  views: [
    {
      type: "sections",
      title: "Demo",
      path: "home",
      icon: "mdi:home-assistant",
      badges: [
        { type: "entity", entity: "sensor.outdoor_temperature", color: "red" },
        { type: "entity", entity: "sensor.outdoor_humidity", color: "indigo" },
        { type: "entity", entity: "device_tracker.car" },
      ],
      sections: [
        // ── Welcome ──────────────────────────────────────────────
        {
          type: "grid",
          cards: [
            { type: "heading", heading: "Welcome \ud83d\udc4b" },
            {
              type: "markdown",
              content:
                "**Home Demo**\nby Home Assistant\n\nWelcome home! You\u2019ve reached the Home Assistant demo where we showcase the best UIs created by our community.\n\n[Learn more about Home Assistant](https://www.home-assistant.io)",
            },
          ],
        },

        // ── Living room ──────────────────────────────────────────
        {
          type: "grid",
          cards: [
            {
              type: "heading",
              heading: "Living room",
              icon: "mdi:sofa",
              badges: [
                { type: "entity", entity: "sensor.living_room_temperature", color: "red" },
                { type: "entity", entity: "sensor.living_room_humidity", color: "indigo" },
              ],
            },
            { type: "tile", entity: "light.floor_lamp" },
            {
              type: "tile",
              entity: "light.living_room_spotlights",
              name: "Spotlights",
              features: [{ type: "light-brightness" }],
            },
            { type: "tile", entity: "light.bar_lamp" },
            {
              type: "tile",
              entity: "cover.living_room_garden_shutter",
              name: "Blinds",
            },
            { type: "tile", entity: "media_player.living_room_nest_mini" },
          ],
        },

        // ── Kitchen ──────────────────────────────────────────────
        {
          type: "grid",
          cards: [
            {
              type: "heading",
              heading: "Kitchen",
              icon: "mdi:fridge",
              badges: [
                {
                  type: "entity",
                  entity: "binary_sensor.kitchen_motion",
                  show_state: false,
                  color: "blue",
                },
              ],
            },
            { type: "tile", entity: "cover.kitchen_shutter", name: "Shutter" },
            {
              type: "tile",
              entity: "light.kitchen_spotlights",
              name: "Spotlights",
              features: [{ type: "light-brightness" }],
            },
            { type: "tile", entity: "light.worktop_spotlights", name: "Worktop" },
            { type: "tile", entity: "binary_sensor.fridge_door", name: "Fridge" },
            { type: "tile", entity: "media_player.kitchen_nest_audio" },
          ],
        },

        // ── Energy ───────────────────────────────────────────────
        {
          type: "grid",
          cards: [
            { type: "heading", heading: "Energy", icon: "mdi:transmission-tower" },
            {
              type: "tile",
              entity: "binary_sensor.tesla_wall_connector_vehicle_connected",
              name: "EV",
              icon: "mdi:car",
            },
            {
              type: "tile",
              entity: "sensor.tesla_wall_connector_session_energy",
              name: "Last charge",
              color: "green",
            },
            {
              type: "tile",
              entity: "sensor.electric_meter_power",
              color: "deep-orange",
              name: "Home power",
            },
            {
              type: "tile",
              entity: "sensor.eletric_meter_voltage",
              name: "Voltage",
              color: "deep-orange",
            },
            {
              type: "tile",
              entity: "sensor.electricity_maps_grid_fossil_fuel_percentage",
              name: "Fossil fuel",
              color: "brown",
            },
            {
              type: "tile",
              entity: "sensor.electricity_maps_co2_intensity",
              name: "CO2 Intensity",
              color: "dark-grey",
            },
          ],
        },

        // ── Climate ──────────────────────────────────────────────
        {
          type: "grid",
          cards: [
            { type: "heading", heading: "Climate", icon: "mdi:thermometer" },
            { type: "tile", entity: "sun.sun" },
            { type: "tile", entity: "sensor.rain", color: "blue" },
            {
              type: "tile",
              entity: "climate.ground_floor",
              name: "Downstairs",
              state_content: ["preset_mode", "current_temperature"],
              features: [{ type: "target-temperature" }],
            },
            {
              type: "tile",
              entity: "climate.first_floor",
              name: "Upstairs",
              state_content: ["preset_mode", "current_temperature"],
              features: [{ type: "target-temperature" }],
            },
          ],
        },

        // ── Study ────────────────────────────────────────────────
        {
          type: "grid",
          cards: [
            {
              type: "heading",
              heading: "Study",
              icon: "mdi:desk-lamp",
              badges: [
                {
                  type: "entity",
                  entity: "switch.in_meeting",
                  state: "on",
                  state_content: "name",
                  visibility: [{ condition: "state", state: "on", entity: "switch.in_meeting" }],
                },
              ],
            },
            { type: "tile", entity: "cover.study_shutter", name: "Shutter" },
            { type: "tile", entity: "light.study_spotlights", name: "Spotlights" },
            { type: "tile", entity: "media_player.study_nest_hub" },
            {
              type: "tile",
              entity: "sensor.standing_desk_height",
              name: "Desk",
              color: "brown",
              icon: "mdi:desk",
            },
            { type: "tile", entity: "switch.in_meeting", name: "Meeting mode" },
          ],
        },

        // ── Outdoor ──────────────────────────────────────────────
        {
          type: "grid",
          cards: [
            { type: "heading", heading: "Outdoor", icon: "mdi:tree" },
            { type: "tile", entity: "light.outdoor_light", name: "Door light" },
            { type: "tile", entity: "light.flood_light" },
            {
              type: "sensor",
              entity: "sensor.outdoor_motion_sensor_temperature",
              detail: 1,
              name: "Temperature",
              graph: "line",
            },
            {
              type: "tile",
              entity: "binary_sensor.outdoor_motion_sensor_motion",
              name: "Motion",
              color: "blue",
            },
            {
              type: "tile",
              entity: "sensor.outdoor_motion_sensor_illuminance",
              name: "Illuminance",
              color: "amber",
            },
          ],
        },

        // ── Updates ──────────────────────────────────────────────
        {
          type: "grid",
          cards: [
            { type: "heading", heading: "Updates", icon: "mdi:update" },
            {
              type: "tile",
              entity: "automation.home_assistant_auto_update",
              name: "Auto-update",
              color: "green",
            },
            {
              type: "tile",
              entity: "update.home_assistant_operating_system_update",
              name: "OS",
              icon: "mdi:home-assistant",
            },
            {
              type: "tile",
              entity: "update.home_assistant_supervisor_update",
              icon: "mdi:home-assistant",
              name: "Supervisor",
            },
            {
              type: "tile",
              entity: "update.home_assistant_core_update",
              name: "Core",
              icon: "mdi:home-assistant",
            },
          ],
        },
      ],
    },
  ],
};
