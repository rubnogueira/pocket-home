/**
 * Reactive entity store.
 * Vue `reactive` map of entity_id → HassEntity, updated by DataSource subscriptions.
 */

import { reactive, ref } from "vue";
import { onFrame } from "@pocketjs/framework/lifecycle";
import type { HassEntity, EntityState } from "../types/entity.ts";
import { entityDomain, TOGGLE_DOMAINS } from "../types/entity.ts";
import type { DataSource } from "./data-source.ts";
import type { Ref } from "vue";

export interface EntityStore {
  /** All entities keyed by entity_id. Reactive — reads track automatically. */
  entities: EntityState;
  /** Increments each time any entity changes. Read in templates to track changes. */
  version: { value: number };
  /** Get a single entity or undefined. */
  get(entityId: string): HassEntity | undefined;
  /** Load initial states and start live subscription. */
  init(source: DataSource): Promise<void>;
  /** Stop subscription. */
  dispose(): void;
}

export function createEntityStore(): EntityStore {
  const entities: EntityState = reactive({});
  const version = ref(0);
  let unsub: (() => void) | undefined;

  function get(entityId: string): HassEntity | undefined {
    return entities[entityId];
  }

  async function init(source: DataSource): Promise<void> {
    // Fetch initial snapshot.
    const states = await source.getStates();
    for (const [id, e] of Object.entries(states)) {
      entities[id] = e;
    }

    // Subscribe to live changes.
    unsub = source.subscribeEntities((changed) => {
      for (const [id, e] of Object.entries(changed)) {
        entities[id] = e;
      }
      version.value++;
    });
  }

  function dispose(): void {
    if (unsub) {
      unsub();
      unsub = undefined;
    }
    for (const key of Object.keys(entities)) delete entities[key];
  }

  return { entities, version, get, init, dispose };
}

/** Check if an entity is in an active/on state. */
export function isEntityOn(entity: HassEntity | undefined): boolean {
  if (!entity) return false;
  const s = entity.state;
  return (
    s === "on" ||
    s === "playing" ||
    s === "open" ||
    s === "unlocked" ||
    s === "home" ||
    s === "heat" ||
    s === "cool" ||
    s === "auto" ||
    s === "armed_home" ||
    s === "armed_away"
  );
}

/** Get the display name of an entity. */
export function entityName(entity: HassEntity | undefined, fallback = ""): string {
  if (!entity) return fallback;
  return (
    entity.attributes.friendly_name ??
    entity.entity_id.split(".")[1]?.replace(/_/g, " ") ??
    fallback
  );
}

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const BINARY_SENSOR_STATE: Record<string, [string, string]> = {
  door: ["Open", "Closed"],
  window: ["Open", "Closed"],
  garage_door: ["Open", "Closed"],
  opening: ["Open", "Closed"],
  lock: ["Unlocked", "Locked"],
  motion: ["Detected", "Clear"],
  presence: ["Home", "Away"],
  occupancy: ["Detected", "Clear"],
  plug: ["Plugged in", "Unplugged"],
  power: ["Powered", "No power"],
  connectivity: ["Connected", "Disconnected"],
  battery: ["Low", "Normal"],
  moisture: ["Wet", "Dry"],
  gas: ["Detected", "Clear"],
  smoke: ["Detected", "Clear"],
  problem: ["Problem", "OK"],
  safety: ["Unsafe", "Safe"],
  tamper: ["Detected", "Clear"],
  running: ["Running", "Not running"],
  vibration: ["Detected", "Clear"],
  sound: ["Detected", "Clear"],
  heat: ["Hot", "Normal"],
  cold: ["Cold", "Normal"],
  light: ["Light", "Dark"],
  moving: ["Moving", "Stopped"],
};

/** Get the display state string — matches Home Assistant's state formatting. */
export function entityStateDisplay(entity: HassEntity | undefined): string {
  if (!entity) return "unavailable";
  const s = entity.state;
  const domain = entityDomain(entity.entity_id);
  const attrs = entity.attributes;

  // Light: show brightness percentage when on
  if (domain === "light") {
    if (s === "on" && attrs.brightness != null) {
      return `${Math.round(((attrs.brightness as number) / 255) * 100)}%`;
    }
    return capitalize(s);
  }

  // Cover: "Open · 100%" or "Closed"
  if (domain === "cover") {
    const pos = attrs.current_position;
    if (s === "open" && pos != null) return `Open \u00b7 ${pos}%`;
    return capitalize(s.replace(/_/g, " "));
  }

  // Climate: "Comfort · 20.8 °C"
  if (domain === "climate") {
    const parts: string[] = [];
    if (attrs.preset_mode) parts.push(capitalize(String(attrs.preset_mode)));
    if (attrs.current_temperature != null) parts.push(`${attrs.current_temperature} \u00b0C`);
    if (parts.length) return parts.join(" \u00b7 ");
    return capitalize(s.replace(/_/g, " "));
  }

  // Binary sensor: device_class-specific on/off labels
  if (domain === "binary_sensor") {
    const dc = (attrs.device_class as string) ?? "";
    const labels = BINARY_SENSOR_STATE[dc];
    if (labels) return s === "on" ? labels[0] : labels[1];
    return s === "on" ? "On" : "Off";
  }

  // Update: "Up-to-date" or available version
  if (domain === "update") {
    if (
      attrs.installed_version &&
      attrs.latest_version &&
      attrs.installed_version === attrs.latest_version
    )
      return "Up-to-date";
    if (s === "on" && attrs.latest_version) return String(attrs.latest_version);
    return capitalize(s);
  }

  // Sensor: value + unit
  if (domain === "sensor") {
    const unit = attrs.unit_of_measurement;
    return unit ? `${s} ${unit}` : s.replace(/_/g, " ");
  }

  // Device tracker: "Home" / "Away"
  if (domain === "device_tracker" || domain === "person") {
    if (s === "home") return "Home";
    if (s === "not_home") return "Away";
    return capitalize(s.replace(/_/g, " "));
  }

  // Sun
  if (domain === "sun") {
    return capitalize(s.replace(/_/g, " "));
  }

  // Media player: capitalize state
  if (domain === "media_player") {
    return capitalize(s.replace(/_/g, " "));
  }

  // Default: capitalize + replace underscores, append unit if present
  const unit = attrs.unit_of_measurement;
  if (unit) return `${s} ${unit}`;
  return capitalize(s.replace(/_/g, " "));
}

/**
 * Resolve state_content to a display string.
 * In HA, tile cards can specify `state_content: string | string[]` to show
 * specific attributes instead of the default state display.
 * e.g. state_content: ["preset_mode", "current_temperature"] → "Comfort · 20.8 °C"
 */
export function entityStateContentDisplay(
  entity: HassEntity | undefined,
  stateContent: string | string[] | undefined,
): string {
  if (!entity) return "unavailable";
  if (!stateContent) return entityStateDisplay(entity);

  const keys = Array.isArray(stateContent) ? stateContent : [stateContent];
  const parts: string[] = [];

  for (const key of keys) {
    if (key === "state") {
      parts.push(entityStateDisplay(entity));
    } else if (key === "name") {
      parts.push(entityName(entity));
    } else if (key === "last_changed") {
      parts.push(formatRelativeTime(entity.last_changed));
    } else if (key === "last_updated") {
      parts.push(formatRelativeTime(entity.last_updated));
    } else {
      const val = entity.attributes[key];
      if (val != null) {
        const unit = key.includes("temperature")
          ? (entity.attributes.unit_of_measurement ?? "\u00b0C")
          : "";
        const display =
          typeof val === "number" ? String(val) : capitalize(String(val).replace(/_/g, " "));
        parts.push(unit ? `${display} ${unit}` : display);
      }
    }
  }

  return parts.length > 0 ? parts.join(" \u00b7 ") : entityStateDisplay(entity);
}

function formatRelativeTime(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  } catch {
    return iso;
  }
}

/** Check if an entity supports toggle. */
export function isToggleable(entity: HassEntity | undefined): boolean {
  if (!entity) return false;
  return TOGGLE_DOMAINS.has(entityDomain(entity.entity_id));
}

/**
 * Reactive entity hook. Returns a ref that updates each frame
 * when the entity changes in the reactive store. Use `.value`
 * in templates to track the dependency.
 */
export function useEntity(entities: EntityState, entityId: string): Ref<HassEntity | undefined> {
  const entity = ref<HassEntity | undefined>(entities[entityId]);
  onFrame(() => {
    const e = entities[entityId];
    if (e !== entity.value) entity.value = e;
  });
  return entity;
}
