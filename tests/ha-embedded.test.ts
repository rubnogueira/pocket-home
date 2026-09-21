/**
 * Tests for the Home Assistant dashboard renderer layer.
 *
 * Covers:
 *   - EmbeddedDataSource entity completeness and attribute accuracy
 *   - entityStateDisplay / entityStateContentDisplay formatting
 *   - Entity store helpers (isEntityOn, isToggleable, entityName)
 *   - Dashboard config structure validation
 *
 * Run: bun test tests/ha-embedded.test.ts
 */

import { join } from "node:path";
import { describe, expect, test, beforeAll } from "bun:test";

const APP_ROOT = join(import.meta.dir, "..");
import { EmbeddedDataSource } from "../app/store/embedded-source.ts";
import type { EntityState } from "../app/types/entity.ts";
import { entityDomain } from "../app/types/entity.ts";
import {
  isEntityOn,
  entityName,
  entityStateDisplay,
  entityStateContentDisplay,
  isToggleable,
} from "../app/store/entity-store.ts";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let source: EmbeddedDataSource;
let states: EntityState;

beforeAll(async () => {
  source = new EmbeddedDataSource();
  await source.connect();
  states = await source.getStates();
});

// ---------------------------------------------------------------------------
// Entity completeness — every entity from the HA demo must exist
// ---------------------------------------------------------------------------

const EXPECTED_ENTITIES = [
  "cover.living_room_garden_shutter",
  "cover.living_room_graveyard_shutter",
  "cover.living_room_left_shutter",
  "cover.living_room_right_shutter",
  "light.floor_lamp",
  "light.living_room_spotlights",
  "light.bar_lamp",
  "sensor.living_room_temperature",
  "sensor.living_room_humidity",
  "sensor.outdoor_temperature",
  "sensor.outdoor_humidity",
  "device_tracker.car",
  "media_player.living_room_nest_mini",
  "cover.kitchen_shutter",
  "light.kitchen_spotlights",
  "binary_sensor.kitchen_motion",
  "light.worktop_spotlights",
  "binary_sensor.fridge_door",
  "media_player.kitchen_nest_audio",
  "binary_sensor.tesla_wall_connector_vehicle_connected",
  "sensor.tesla_wall_connector_session_energy",
  "sensor.electric_meter_power",
  "sensor.eletric_meter_voltage",
  "sensor.electricity_maps_grid_fossil_fuel_percentage",
  "sensor.electricity_maps_co2_intensity",
  "sun.sun",
  "sensor.rain",
  "climate.ground_floor",
  "climate.first_floor",
  "cover.study_shutter",
  "light.study_spotlights",
  "media_player.study_nest_hub",
  "switch.in_meeting",
  "sensor.standing_desk_height",
  "light.outdoor_light",
  "light.flood_light",
  "sensor.outdoor_motion_sensor_temperature",
  "binary_sensor.outdoor_motion_sensor_motion",
  "sensor.outdoor_motion_sensor_illuminance",
  "automation.home_assistant_auto_update",
  "update.home_assistant_operating_system_update",
  "update.home_assistant_supervisor_update",
  "update.home_assistant_core_update",
];

describe("EmbeddedDataSource entity completeness", () => {
  test("all HA demo entities exist", () => {
    for (const id of EXPECTED_ENTITIES) {
      expect(states[id]).toBeDefined();
    }
  });

  test("total entity count matches expected", () => {
    expect(Object.keys(states).length).toBe(EXPECTED_ENTITIES.length);
  });
});

// ---------------------------------------------------------------------------
// Entity attribute accuracy — key attributes match the HA demo values
// ---------------------------------------------------------------------------

describe("Entity attribute accuracy", () => {
  test("light.floor_lamp has full color attributes", () => {
    const e = states["light.floor_lamp"];
    expect(e.state).toBe("on");
    expect(e.attributes.brightness).toBe(178);
    expect(e.attributes.supported_color_modes).toEqual(["color_temp", "xy"]);
    expect(e.attributes.color_mode).toBe("color_temp");
    expect(e.attributes.color_temp).toBe(387);
    expect(e.attributes.color_temp_kelvin).toBe(2583);
    expect(e.attributes.min_mireds).toBe(153);
    expect(e.attributes.max_mireds).toBe(500);
    expect(e.attributes.icon).toBe("mdi:floor-lamp");
    expect(e.attributes.rgb_color).toEqual([255, 162, 77]);
    expect(e.attributes.hs_color).toEqual([28.664, 69.597]);
    expect(e.attributes.xy_color).toEqual([0.538, 0.389]);
    expect(e.attributes.supported_features).toBe(44);
  });

  test("light.bar_lamp has effect_list and color_temp range", () => {
    const e = states["light.bar_lamp"];
    expect(e.state).toBe("on");
    expect(e.attributes.effect_list).toEqual(["None", "candle"]);
    expect(e.attributes.supported_color_modes).toEqual(["color_temp"]);
    expect(e.attributes.min_color_temp_kelvin).toBe(2202);
    expect(e.attributes.max_color_temp_kelvin).toBe(4504);
    expect(e.attributes.icon).toBe("mdi:lightbulb-variant");
  });

  test("binary_sensor.kitchen_motion exists with device_class motion", () => {
    const e = states["binary_sensor.kitchen_motion"];
    expect(e.state).toBe("on");
    expect(e.attributes.device_class).toBe("motion");
  });

  test("media_player.living_room_nest_mini has full media attributes", () => {
    const e = states["media_player.living_room_nest_mini"];
    expect(e.state).toBe("playing");
    expect(e.attributes.media_title).toContain("Born To Follow");
    expect(e.attributes.media_artist).toBe("The Byrds");
    expect(e.attributes.media_album_name).toBe("The Notorious Byrd Brothers");
    expect(e.attributes.media_duration).toBe(300);
    expect(e.attributes.source_list).toEqual(["It's A Party", "Radio HSL", "Retro 70s and 80s"]);
    expect(e.attributes.volume_level).toBe(0.18);
    expect(e.attributes.shuffle).toBe(false);
    expect(e.attributes.supported_features).toBe(64063);
  });

  test("climate.ground_floor has full climate attributes from HA demo", () => {
    const e = states["climate.ground_floor"];
    expect(e.state).toBe("heat");
    expect(e.attributes.temperature).toBe(21);
    expect(e.attributes.current_temperature).toBe(20.8);
    expect(e.attributes.min_temp).toBe(7);
    expect(e.attributes.max_temp).toBe(35);
    expect(e.attributes.hvac_modes).toEqual(["auto", "heat", "off"]);
    expect(e.attributes.preset_modes).toEqual([
      "comfort",
      "away",
      "eco",
      "frost_protection",
      "external",
      "home",
    ]);
    expect(e.attributes.preset_mode).toBe("comfort");
    expect(e.attributes.icon).toBe("mdi:home-floor-0");
    expect(e.attributes.supported_features).toBe(401);
  });

  test("climate.first_floor has correct icon", () => {
    const e = states["climate.first_floor"];
    expect(e.attributes.icon).toBe("mdi:home-floor-1");
  });

  test("sun.sun has astronomical attributes", () => {
    const e = states["sun.sun"];
    expect(e.attributes.elevation).toBe(30.38);
    expect(e.attributes.azimuth).toBe(204.42);
    expect(e.attributes.rising).toBe(false);
    expect(e.attributes.next_dawn).toBeDefined();
  });

  test("device_tracker.car has icon", () => {
    const e = states["device_tracker.car"];
    expect(e.attributes.icon).toBe("mdi:car");
  });

  test("switch.in_meeting has icon", () => {
    const e = states["switch.in_meeting"];
    expect(e.attributes.icon).toBe("mdi:laptop-account");
  });

  test("sensor.electricity_maps entities have state_class and attribution", () => {
    const co2 = states["sensor.electricity_maps_co2_intensity"];
    expect(co2.attributes.state_class).toBe("measurement");
    expect(co2.attributes.attribution).toBe("Data provided by Electricity Maps");
    expect(co2.attributes.icon).toBe("mdi:molecule-co2");

    const fossil = states["sensor.electricity_maps_grid_fossil_fuel_percentage"];
    expect(fossil.attributes.state_class).toBe("measurement");
    expect(fossil.attributes.icon).toBe("mdi:barrel");
  });

  test("update entities have full update attributes", () => {
    const os = states["update.home_assistant_operating_system_update"];
    expect(os.attributes.installed_version).toBe("12.1");
    expect(os.attributes.latest_version).toBe("12.1");
    expect(os.attributes.auto_update).toBe(false);
    expect(os.attributes.in_progress).toBe(false);
    expect(os.attributes.title).toBe("Home Assistant Operating System");
    expect(os.attributes.supported_features).toBe(3);
  });

  test("automation entity has mode, last_triggered, and icon", () => {
    const e = states["automation.home_assistant_auto_update"];
    expect(e.attributes.icon).toBe("mdi:auto-mode");
    expect(e.attributes.mode).toBe("queued");
    expect(e.attributes.last_triggered).toBeDefined();
  });

  test("sensors have state_class attribute", () => {
    const tempSensors = [
      "sensor.living_room_temperature",
      "sensor.outdoor_temperature",
      "sensor.outdoor_motion_sensor_temperature",
    ];
    for (const id of tempSensors) {
      expect(states[id].attributes.state_class).toBe("measurement");
    }

    expect(states["sensor.rain"].attributes.state_class).toBe("total_increasing");
    expect(states["sensor.tesla_wall_connector_session_energy"].attributes.state_class).toBe(
      "total_increasing",
    );
  });
});

// ---------------------------------------------------------------------------
// entityStateDisplay — state formatting
// ---------------------------------------------------------------------------

describe("entityStateDisplay", () => {
  test("light on with brightness shows percentage", () => {
    const e = states["light.floor_lamp"];
    expect(entityStateDisplay(e)).toBe("70%");
  });

  test("light off shows Off", () => {
    const e = states["light.kitchen_spotlights"];
    expect(entityStateDisplay(e)).toBe("Off");
  });

  test("cover open with position shows Open · N%", () => {
    const e = states["cover.living_room_garden_shutter"];
    expect(entityStateDisplay(e)).toBe("Open \u00b7 100%");
  });

  test("climate shows preset + current temp", () => {
    const e = states["climate.ground_floor"];
    const display = entityStateDisplay(e);
    expect(display).toContain("Comfort");
    expect(display).toContain("20.8");
  });

  test("binary_sensor with device_class door shows Closed", () => {
    const e = states["binary_sensor.fridge_door"];
    expect(entityStateDisplay(e)).toBe("Closed");
  });

  test("binary_sensor with device_class motion on shows Detected", () => {
    const e = states["binary_sensor.kitchen_motion"];
    expect(entityStateDisplay(e)).toBe("Detected");
  });

  test("sensor shows value + unit", () => {
    const e = states["sensor.living_room_temperature"];
    expect(entityStateDisplay(e)).toBe("22.8 \u00b0C");
  });

  test("device_tracker not_home shows Away", () => {
    const e = states["device_tracker.car"];
    expect(entityStateDisplay(e)).toBe("Away");
  });

  test("update with same versions shows Up-to-date", () => {
    const e = states["update.home_assistant_core_update"];
    expect(entityStateDisplay(e)).toBe("Up-to-date");
  });

  test("sun shows Above horizon", () => {
    const e = states["sun.sun"];
    expect(entityStateDisplay(e)).toBe("Above horizon");
  });

  test("media_player playing shows Playing", () => {
    const e = states["media_player.living_room_nest_mini"];
    expect(entityStateDisplay(e)).toBe("Playing");
  });

  test("undefined entity returns unavailable", () => {
    expect(entityStateDisplay(undefined)).toBe("unavailable");
  });
});

// ---------------------------------------------------------------------------
// entityStateContentDisplay — state_content rendering
// ---------------------------------------------------------------------------

describe("entityStateContentDisplay", () => {
  test("undefined state_content falls back to entityStateDisplay", () => {
    const e = states["light.floor_lamp"];
    expect(entityStateContentDisplay(e, undefined)).toBe(entityStateDisplay(e));
  });

  test("single string state_content shows attribute value", () => {
    const e = states["climate.ground_floor"];
    expect(entityStateContentDisplay(e, "preset_mode")).toContain("Comfort");
  });

  test("array state_content joins with middle dot", () => {
    const e = states["climate.ground_floor"];
    const display = entityStateContentDisplay(e, ["preset_mode", "current_temperature"]);
    expect(display).toContain("Comfort");
    expect(display).toContain("20.8");
    expect(display).toContain("\u00b7");
  });

  test("'state' key shows default state display", () => {
    const e = states["light.floor_lamp"];
    expect(entityStateContentDisplay(e, "state")).toBe(entityStateDisplay(e));
  });

  test("'name' key shows entity friendly name", () => {
    const e = states["switch.in_meeting"];
    expect(entityStateContentDisplay(e, "name")).toBe("In a meeting");
  });

  test("missing attribute key is skipped", () => {
    const e = states["light.floor_lamp"];
    const display = entityStateContentDisplay(e, ["nonexistent_attr"]);
    expect(display).toBe(entityStateDisplay(e));
  });
});

// ---------------------------------------------------------------------------
// Entity store helpers
// ---------------------------------------------------------------------------

describe("isEntityOn", () => {
  test("returns true for playing media player", () => {
    expect(isEntityOn(states["media_player.living_room_nest_mini"])).toBe(true);
  });

  test("returns true for open cover", () => {
    expect(isEntityOn(states["cover.living_room_garden_shutter"])).toBe(true);
  });

  test("returns true for on switch", () => {
    expect(isEntityOn(states["switch.in_meeting"])).toBe(true);
  });

  test("returns false for off light", () => {
    expect(isEntityOn(states["light.kitchen_spotlights"])).toBe(false);
  });

  test("returns true for heat climate", () => {
    expect(isEntityOn(states["climate.ground_floor"])).toBe(true);
  });

  test("returns false for undefined", () => {
    expect(isEntityOn(undefined)).toBe(false);
  });
});

describe("isToggleable", () => {
  test("light is toggleable", () => {
    expect(isToggleable(states["light.floor_lamp"])).toBe(true);
  });

  test("switch is toggleable", () => {
    expect(isToggleable(states["switch.in_meeting"])).toBe(true);
  });

  test("cover is toggleable", () => {
    expect(isToggleable(states["cover.living_room_garden_shutter"])).toBe(true);
  });

  test("sensor is not toggleable", () => {
    expect(isToggleable(states["sensor.living_room_temperature"])).toBe(false);
  });

  test("binary_sensor is not toggleable", () => {
    expect(isToggleable(states["binary_sensor.fridge_door"])).toBe(false);
  });
});

describe("entityName", () => {
  test("returns friendly_name", () => {
    expect(entityName(states["light.floor_lamp"])).toBe("Floor lamp");
  });

  test("returns fallback for undefined", () => {
    expect(entityName(undefined, "fallback")).toBe("fallback");
  });
});

// ---------------------------------------------------------------------------
// Dashboard config structure
// ---------------------------------------------------------------------------

describe("Dashboard config structure", () => {
  let config: any;

  beforeAll(async () => {
    config = await source.getDashboardConfig();
  });

  test("dashboard has title", () => {
    expect(config.title).toBe("Home Assistant Demo");
  });

  test("dashboard has one sections view", () => {
    expect(config.views.length).toBe(1);
    expect(config.views[0].type).toBe("sections");
  });

  test("view has 3 badges", () => {
    expect(config.views[0].badges.length).toBe(3);
    expect(config.views[0].badges[0].entity).toBe("sensor.outdoor_temperature");
    expect(config.views[0].badges[0].color).toBe("red");
    expect(config.views[0].badges[2].entity).toBe("device_tracker.car");
  });

  test("view has 8 sections (welcome + 7 rooms)", () => {
    expect(config.views[0].sections.length).toBe(8);
  });

  test("living room section has heading with text and badges", () => {
    const livingRoom = config.views[0].sections[1];
    const heading = livingRoom.cards[0];
    expect(heading.type).toBe("heading");
    expect(heading.heading).toBe("Living room");
    expect(heading.icon).toBe("mdi:sofa");
    expect(heading.badges.length).toBe(2);
    expect(heading.badges[0].entity).toBe("sensor.living_room_temperature");
  });

  test("kitchen section heading has motion badge with show_state false", () => {
    const kitchen = config.views[0].sections[2];
    const heading = kitchen.cards[0];
    expect(heading.heading).toBe("Kitchen");
    expect(heading.badges[0].show_state).toBe(false);
    expect(heading.badges[0].color).toBe("blue");
  });

  test("energy section tiles have color configs", () => {
    const energy = config.views[0].sections[3];
    const cards = energy.cards;
    const lastCharge = cards.find((c: any) => c.name === "Last charge");
    expect(lastCharge.color).toBe("green");
    const homePower = cards.find((c: any) => c.name === "Home power");
    expect(homePower.color).toBe("deep-orange");
  });

  test("climate tiles have state_content and features", () => {
    const climate = config.views[0].sections[4];
    const downstairs = climate.cards.find((c: any) => c.name === "Downstairs");
    expect(downstairs.state_content).toEqual(["preset_mode", "current_temperature"]);
    expect(downstairs.features[0].type).toBe("target-temperature");
  });

  test("study section heading has badge with visibility conditions", () => {
    const study = config.views[0].sections[5];
    const heading = study.cards[0];
    expect(heading.badges[0].entity).toBe("switch.in_meeting");
    expect(heading.badges[0].state_content).toBe("name");
    expect(heading.badges[0].visibility.length).toBe(1);
    expect(heading.badges[0].visibility[0].condition).toBe("state");
  });

  test("outdoor section has sensor card with graph: line", () => {
    const outdoor = config.views[0].sections[6];
    const sensorCard = outdoor.cards.find((c: any) => c.type === "sensor");
    expect(sensorCard).toBeDefined();
    expect(sensorCard.graph).toBe("line");
    expect(sensorCard.detail).toBe(1);
  });

  test("all section headings have proper text", () => {
    const sections = config.views[0].sections;
    const headingTexts = sections.map((s: any) => {
      const heading = s.cards.find((c: any) => c.type === "heading");
      return heading?.heading ?? "";
    });
    expect(headingTexts).toEqual([
      "Welcome \ud83d\udc4b",
      "Living room",
      "Kitchen",
      "Energy",
      "Climate",
      "Study",
      "Outdoor",
      "Updates",
    ]);
  });
});

// ---------------------------------------------------------------------------
// callService — mock service dispatch
// ---------------------------------------------------------------------------

describe("callService", () => {
  test("toggle light changes state", async () => {
    const before = { ...(await source.getStates())["light.floor_lamp"] };
    expect(before.state).toBe("on");

    await source.callService("light", "turn_off", {}, { entity_id: "light.floor_lamp" });
    const after = (await source.getStates())["light.floor_lamp"];
    expect(after.state).toBe("off");

    await source.callService("light", "turn_on", {}, { entity_id: "light.floor_lamp" });
    const restored = (await source.getStates())["light.floor_lamp"];
    expect(restored.state).toBe("on");
  });

  test("set temperature updates attribute", async () => {
    await source.callService(
      "climate",
      "set_temperature",
      { temperature: 22 },
      { entity_id: "climate.ground_floor" },
    );
    const e = (await source.getStates())["climate.ground_floor"];
    expect(e.attributes.temperature).toBe(22);

    await source.callService(
      "climate",
      "set_temperature",
      { temperature: 21 },
      { entity_id: "climate.ground_floor" },
    );
  });

  test("cover open/close changes state and position", async () => {
    await source.callService(
      "cover",
      "close_cover",
      {},
      { entity_id: "cover.living_room_garden_shutter" },
    );
    let e = (await source.getStates())["cover.living_room_garden_shutter"];
    expect(e.state).toBe("closed");
    expect(e.attributes.current_position).toBe(0);

    await source.callService(
      "cover",
      "open_cover",
      {},
      { entity_id: "cover.living_room_garden_shutter" },
    );
    e = (await source.getStates())["cover.living_room_garden_shutter"];
    expect(e.state).toBe("open");
    expect(e.attributes.current_position).toBe(100);
  });

  test("media_player play/pause toggles state", async () => {
    await source.callService(
      "media_player",
      "media_play_pause",
      {},
      { entity_id: "media_player.living_room_nest_mini" },
    );
    let e = (await source.getStates())["media_player.living_room_nest_mini"];
    expect(e.state).toBe("paused");

    await source.callService(
      "media_player",
      "media_play_pause",
      {},
      { entity_id: "media_player.living_room_nest_mini" },
    );
    e = (await source.getStates())["media_player.living_room_nest_mini"];
    expect(e.state).toBe("playing");
  });

  test("switch toggle changes state", async () => {
    await source.callService("switch", "toggle", {}, { entity_id: "switch.in_meeting" });
    let e = (await source.getStates())["switch.in_meeting"];
    expect(e.state).toBe("off");

    await source.callService("switch", "toggle", {}, { entity_id: "switch.in_meeting" });
    e = (await source.getStates())["switch.in_meeting"];
    expect(e.state).toBe("on");
  });

  test("set brightness updates attribute", async () => {
    await source.callService(
      "light",
      "turn_on",
      { brightness: 200 },
      { entity_id: "light.floor_lamp" },
    );
    const e = (await source.getStates())["light.floor_lamp"];
    expect(e.attributes.brightness).toBe(200);

    await source.callService(
      "light",
      "turn_on",
      { brightness: 178 },
      { entity_id: "light.floor_lamp" },
    );
  });

  test("subscriber receives changes", async () => {
    let received: EntityState | null = null;
    const unsub = source.subscribeEntities((changed) => {
      received = changed;
    });

    await source.callService("switch", "toggle", {}, { entity_id: "switch.in_meeting" });
    expect(received).not.toBeNull();
    expect(received!["switch.in_meeting"]).toBeDefined();

    await source.callService("switch", "toggle", {}, { entity_id: "switch.in_meeting" });
    unsub();
  });
});

// ---------------------------------------------------------------------------
// entityDomain helper
// ---------------------------------------------------------------------------

describe("entityDomain", () => {
  test("extracts domain from entity_id", () => {
    expect(entityDomain("light.floor_lamp")).toBe("light");
    expect(entityDomain("binary_sensor.kitchen_motion")).toBe("binary_sensor");
    expect(entityDomain("climate.ground_floor")).toBe("climate");
    expect(entityDomain("sun.sun")).toBe("sun");
  });
});

// ---------------------------------------------------------------------------
// Layout correctness — padding prop names match the PocketJS PROP spec
// ---------------------------------------------------------------------------

describe("SectionsView uses correct PROP names", () => {
  test("padding style props use paddingT/R/B/L not paddingTop/Right/etc", async () => {
    const src = await Bun.file(join(APP_ROOT, "app/views/SectionsView.tsx")).text();
    // Must use the short PROP names that the engine recognizes
    expect(src).toContain("paddingT:");
    expect(src).toContain("paddingB:");
    expect(src).toContain("paddingL:");
    expect(src).toContain("paddingR:");
    // Must NOT use the long CSS names (engine throws on unknown style props)
    expect(src).not.toContain("paddingTop:");
    expect(src).not.toContain("paddingBottom:");
    expect(src).not.toContain("paddingLeft:");
    expect(src).not.toContain("paddingRight:");
  });

  test("sensor cards are NOT full-width (1 col x 2 rows like HA)", async () => {
    const src = await Bun.file(join(APP_ROOT, "app/views/SectionsView.tsx")).text();
    // FULL_WIDTH_TYPES must include heading and markdown but NOT sensor
    const m = src.match(/FULL_WIDTH_TYPES\s*=\s*new\s+Set\(\[([^\]]+)\]\)/);
    expect(m).not.toBeNull();
    const items = m![1];
    expect(items).toContain('"heading"');
    expect(items).toContain('"markdown"');
    expect(items).not.toContain('"sensor"');
  });

  test("ViewRenderer badge row uses paddingL/paddingR", async () => {
    const src = await Bun.file(join(APP_ROOT, "app/renderer/ViewRenderer.tsx")).text();
    expect(src).toContain("paddingL:");
    expect(src).toContain("paddingR:");
    expect(src).not.toContain("paddingLeft:");
    expect(src).not.toContain("paddingRight:");
  });
});

// ---------------------------------------------------------------------------
// SensorCard text sizing — temperature must use text-2xl
// ---------------------------------------------------------------------------

describe("SensorCard text sizing", () => {
  test("sensor value uses text-2xl for prominent display", async () => {
    const src = await Bun.file(join(APP_ROOT, "app/cards/SensorCard.tsx")).text();
    expect(src).toContain("text-2xl");
    // Must NOT use the smaller text-lg for the main value
    expect(src).not.toMatch(/text-lg.*font-bold.*value/);
  });

  test("sensor unit uses text-sm (not text-xs)", async () => {
    const src = await Bun.file(join(APP_ROOT, "app/cards/SensorCard.tsx")).text();
    expect(src).toMatch(/text-sm.*text-slate-400.*unit/);
  });
});
