/**
 * Home Assistant / MDI icon resolution tests.
 *
 * Run: bun test tests/ha-icons.test.ts
 */

import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { collectHaIconNames } from "../tools/generate-ha-icons.ts";
import {
  normalizeIconName,
  haIconAssetPath,
  weatherIconAssetPath,
  DEVICE_CLASS_ICONS,
} from "../app/icons/resolve.ts";
import { HA_ICON_FALLBACK } from "../app/icons/generated/registry.ts";

const APP_DIR = join(import.meta.dir, "..");

describe("normalizeIconName", () => {
  test("parses mdi prefix", () => {
    expect(normalizeIconName("mdi:lightbulb")).toBe("lightbulb");
  });
  test("parses hass prefix via map", () => {
    expect(normalizeIconName("hass:home-assistant")).toBe("home-assistant");
  });
  test("accepts bare MDI names", () => {
    expect(normalizeIconName("thermometer")).toBe("thermometer");
  });
});

describe("haIconAssetPath", () => {
  test("falls back to domain icon", () => {
    const path = haIconAssetPath(undefined, { domain: "light" });
    expect(path).toContain("lightbulb");
  });
  test("uses explicit mdi icon", () => {
    const path = haIconAssetPath("mdi:car", { domain: "device_tracker" });
    expect(path).toContain("car");
  });
  test("unknown icon uses fallback asset path", () => {
    const unknown = `mdi:${"not-a-real-icon-name-ever"}`;
    const path = haIconAssetPath(unknown, {});
    expect(path).toBe(HA_ICON_FALLBACK);
  });
});

describe("weatherIconAssetPath", () => {
  test("maps OpenWeather codes", () => {
    expect(weatherIconAssetPath("01d")).toContain("weather-sunny");
  });
  test("maps HA condition names", () => {
    expect(weatherIconAssetPath("partlycloudy")).toContain("weather-partly-cloudy");
  });
});

describe("collectHaIconNames", () => {
  test("includes domain defaults and manifest entries", () => {
    const names = collectHaIconNames(APP_DIR);
    expect(names).toContain("lightbulb");
    expect(names).toContain("thermostat");
    expect(names).toContain("help-circle");
    for (const dc of Object.values(DEVICE_CLASS_ICONS)) {
      expect(names).toContain(dc);
    }
    expect(names).not.toContain("not-a-real-icon-name-ever");
  });
});
