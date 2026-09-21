/**
 * Home Assistant icon resolution — same mdi: / domain defaults as the HA frontend.
 */

import { DOMAIN_ICONS } from "../types/entity.ts";
import { HA_ICON_ASSETS, HA_ICON_FALLBACK } from "./generated/registry.ts";

/** Map hass: icons to mdi equivalents where HA ships a distinct prefix. */
const HASS_TO_MDI: Record<string, string> = {
  "home-assistant": "home-assistant",
  home: "home",
  minus: "minus",
  plus: "plus",
};

/** Sensor / binary_sensor device_class → MDI name. */
export const DEVICE_CLASS_ICONS: Record<string, string> = {
  temperature: "thermometer",
  humidity: "water-percent",
  battery: "battery",
  power: "flash",
  energy: "lightning-bolt",
  plug: "power-plug", // device_class
  motion: "motion-sensor",
  door: "door",
  opening: "door-open",
  illuminance: "brightness-5",
  precipitation: "weather-pouring",
  voltage: "flash",
  current: "current-ac",
  gas: "meter-gas",
  carbon_monoxide: "molecule-co",
  co2: "molecule-co2",
  moisture: "water-percent",
  pressure: "gauge",
  signal_strength: "wifi",
};

/** OpenWeather-style icon codes → MDI. */
export const WEATHER_ICON_CODES: Record<string, string> = {
  "01d": "weather-sunny",
  "01n": "weather-night",
  "02d": "weather-partly-cloudy",
  "02n": "weather-night-partly-cloudy",
  "03d": "weather-cloudy",
  "03n": "weather-cloudy",
  "04d": "weather-cloudy",
  "04n": "weather-cloudy",
  "09d": "weather-pouring",
  "09n": "weather-pouring",
  "10d": "weather-rainy",
  "10n": "weather-rainy",
  "11d": "weather-lightning",
  "11n": "weather-lightning",
  "13d": "weather-snowy",
  "13n": "weather-snowy",
  "50d": "weather-fog",
  "50n": "weather-fog",
};

/** Lovelace weather.condition → MDI. */
export const WEATHER_CONDITION_ICONS: Record<string, string> = {
  "clear-night": "weather-night",
  cloudy: "weather-cloudy",
  exceptional: "alert-circle-outline",
  fog: "weather-fog",
  hail: "weather-hail",
  lightning: "weather-lightning",
  "lightning-rainy": "weather-lightning-rainy",
  partlycloudy: "weather-partly-cloudy",
  pouring: "weather-pouring",
  rainy: "weather-rainy",
  snowy: "weather-snowy",
  "snowy-rainy": "weather-snowy-rainy",
  sunny: "weather-sunny",
  windy: "weather-windy",
  "windy-variant": "weather-windy",
};

/** Sidebar / app chrome category → mdi name. */
export const NAV_CATEGORY_ICONS: Record<string, string> = {
  home: "view-dashboard",
  map: "map",
  energy: "lightning-bolt",
  settings: "cog",
  lights: "lightbulb",
  climate: "thermostat",
  security: "shield",
  media: "cast",
};

/**
 * Parse an HA icon string (`mdi` / `hass` prefix, or bare MDI name) into kebab-case.
 */
export function normalizeIconName(icon: string | undefined | null): string | undefined {
  if (!icon) return undefined;
  const trimmed = icon.trim();
  if (!trimmed) return undefined;
  const colon = trimmed.indexOf(":");
  if (colon < 0) return trimmed;
  const prefix = trimmed.slice(0, colon);
  const name = trimmed.slice(colon + 1);
  if (prefix === "mdi") return name;
  if (prefix === "hass") return HASS_TO_MDI[name] ?? name;
  return name;
}

export function mdiAssetPath(kebab: string | undefined): string | undefined {
  if (!kebab) return undefined;
  return HA_ICON_ASSETS[kebab] ?? HA_ICON_ASSETS[kebab.replace(/^mdi:/, "")];
}

/**
 * Resolve a pak image path for an HA icon string, with optional domain / device_class fallbacks.
 */
export function haIconAssetPath(
  icon?: string | null,
  options?: { domain?: string; deviceClass?: string },
): string {
  const candidates: string[] = [];
  const normalized = normalizeIconName(icon ?? undefined);
  if (normalized) candidates.push(normalized);
  if (options?.deviceClass) {
    const dc = DEVICE_CLASS_ICONS[options.deviceClass];
    if (dc) candidates.push(dc);
  }
  if (options?.domain && DOMAIN_ICONS[options.domain]) {
    candidates.push(DOMAIN_ICONS[options.domain]);
  }
  for (const name of candidates) {
    const path = mdiAssetPath(name);
    if (path) return path;
  }
  return HA_ICON_FALLBACK;
}

export function weatherIconAssetPath(codeOrCondition: string | undefined): string {
  if (!codeOrCondition) return HA_ICON_FALLBACK;
  const mdiName =
    WEATHER_ICON_CODES[codeOrCondition] ??
    WEATHER_CONDITION_ICONS[codeOrCondition] ??
    "weather-cloudy";
  return mdiAssetPath(mdiName) ?? HA_ICON_FALLBACK;
}
