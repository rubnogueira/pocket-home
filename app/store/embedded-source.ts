/**
 * EmbeddedDataSource — applies local seed data when no HA instance is reachable.
 * Seed lives in `data/home-assistant-demo-seed.ts` (demo.home-assistant.io snapshot).
 */

import { DEMO_DASHBOARD, DEMO_ENTITIES } from "../data/home-assistant-demo-seed.ts";
import type { DataSource } from "./data-source.ts";
import type { EntityState } from "../types/entity.ts";
import type { LovelaceDashboardConfig, DashboardListItem } from "../types/dashboard.ts";
import type { ServiceTarget } from "../types/action.ts";
import type { HassServiceData } from "../types/service-data.ts";

export class EmbeddedDataSource implements DataSource {
  private state: EntityState = {};
  private subs: Array<(changed: EntityState) => void> = [];

  async connect(): Promise<void> {
    for (const e of DEMO_ENTITIES) {
      this.state[e.entity_id] = { ...e, attributes: { ...e.attributes } };
    }
  }

  disconnect(): void {}

  async getStates(): Promise<EntityState> {
    return { ...this.state };
  }

  subscribeEntities(cb: (changed: EntityState) => void): () => void {
    this.subs.push(cb);
    return () => {
      this.subs = this.subs.filter((c) => c !== cb);
    };
  }

  async callService(
    domain: string,
    service: string,
    data?: Record<string, unknown>,
    target?: ServiceTarget,
  ): Promise<void> {
    const serviceData = data as HassServiceData | undefined;
    const ids = target?.entity_id
      ? Array.isArray(target.entity_id)
        ? target.entity_id
        : [target.entity_id]
      : [];
    const changed: EntityState = {};

    for (const id of ids) {
      const e = this.state[id];
      if (!e) continue;
      const key = `${domain}/${service}`;

      // Generic toggle / on / off
      if (
        key === "homeassistant/toggle" ||
        key === "light/toggle" ||
        key === "switch/toggle" ||
        key === "fan/toggle"
      ) {
        e.state = e.state === "on" ? "off" : "on";
      } else if (key.endsWith("/turn_on")) {
        e.state = "on";
        if (serviceData?.brightness != null) e.attributes.brightness = serviceData.brightness;
        if (serviceData?.color_temp != null) e.attributes.color_temp = serviceData.color_temp;
        if (serviceData?.effect != null) e.attributes.effect = serviceData.effect;
      } else if (key.endsWith("/turn_off")) {
        e.state = "off";

        // Climate
      } else if (key === "climate/set_temperature") {
        if (serviceData?.temperature != null) e.attributes.temperature = serviceData.temperature;
      } else if (key === "climate/set_hvac_mode") {
        if (serviceData?.hvac_mode != null) e.state = String(serviceData.hvac_mode);
      } else if (key === "climate/set_fan_mode") {
        if (serviceData?.fan_mode != null) e.attributes.fan_mode = serviceData.fan_mode;
      } else if (key === "climate/set_preset_mode") {
        if (serviceData?.preset_mode != null) e.attributes.preset_mode = serviceData.preset_mode;
      } else if (key === "climate/set_swing_mode") {
        if (serviceData?.swing_mode != null) e.attributes.swing_mode = serviceData.swing_mode;

        // Cover
      } else if (key === "cover/open_cover") {
        e.state = "open";
        e.attributes.current_position = 100;
      } else if (key === "cover/close_cover") {
        e.state = "closed";
        e.attributes.current_position = 0;
      } else if (key === "cover/stop_cover") {
        // no-op for mock
      } else if (key === "cover/set_cover_position") {
        if (serviceData?.position != null) {
          e.attributes.current_position = serviceData.position;
          e.state = serviceData.position > 0 ? "open" : "closed";
        }
      } else if (key === "cover/set_cover_tilt_position") {
        if (serviceData?.tilt_position != null) {
          e.attributes.current_tilt_position = serviceData.tilt_position;
        }

        // Media player
      } else if (key === "media_player/media_play_pause") {
        e.state = e.state === "playing" ? "paused" : "playing";
      } else if (key === "media_player/media_play") {
        e.state = "playing";
      } else if (key === "media_player/media_pause") {
        e.state = "paused";
      } else if (key === "media_player/media_stop") {
        e.state = "idle";
      } else if (
        key === "media_player/media_previous_track" ||
        key === "media_player/media_next_track"
      ) {
        // mock: no-op (keep current track)
      } else if (key === "media_player/volume_set") {
        if (serviceData?.volume_level != null) e.attributes.volume_level = serviceData.volume_level;
      } else if (key === "media_player/volume_mute") {
        if (serviceData?.is_volume_muted != null) {
          e.attributes.is_volume_muted = serviceData.is_volume_muted;
        }
      } else if (key === "media_player/shuffle_set") {
        if (serviceData?.shuffle != null) e.attributes.shuffle = serviceData.shuffle;
      } else if (key === "media_player/repeat_set") {
        if (serviceData?.repeat != null) e.attributes.repeat = serviceData.repeat;
      } else if (key === "media_player/select_source") {
        if (serviceData?.source != null) e.attributes.source = serviceData.source;
      } else if (key === "media_player/select_sound_mode") {
        if (serviceData?.sound_mode != null) e.attributes.sound_mode = serviceData.sound_mode;

        // Lock
      } else if (key === "lock/lock") {
        e.state = "locked";
      } else if (key === "lock/unlock") {
        e.state = "unlocked";

        // Alarm control panel
      } else if (key === "alarm_control_panel/alarm_arm_home") {
        e.state = "armed_home";
      } else if (key === "alarm_control_panel/alarm_arm_away") {
        e.state = "armed_away";
      } else if (key === "alarm_control_panel/alarm_arm_night") {
        e.state = "armed_night";
      } else if (key === "alarm_control_panel/alarm_arm_vacation") {
        e.state = "armed_vacation";
      } else if (key === "alarm_control_panel/alarm_arm_custom_bypass") {
        e.state = "armed_custom_bypass";
      } else if (key === "alarm_control_panel/alarm_disarm") {
        e.state = "disarmed";
      } else if (key === "alarm_control_panel/alarm_trigger") {
        e.state = "triggered";

        // Automation
      } else if (key === "automation/trigger") {
        e.attributes.last_triggered = new Date().toISOString();

        // Fan
      } else if (key === "fan/set_percentage") {
        if (serviceData?.percentage != null) e.attributes.percentage = serviceData.percentage;
      } else if (key === "fan/oscillate") {
        if (serviceData?.oscillating != null) e.attributes.oscillating = serviceData.oscillating;
      } else if (key === "fan/set_direction") {
        if (serviceData?.direction != null) e.attributes.direction = serviceData.direction;
      } else if (key === "fan/set_preset_mode") {
        if (serviceData?.preset_mode != null) e.attributes.preset_mode = serviceData.preset_mode;

        // Input number / number
      } else if (key === "input_number/set_value" || key === "number/set_value") {
        if (serviceData?.value != null) e.state = String(serviceData.value);

        // Input select / select
      } else if (key === "input_select/select_option" || key === "select/select_option") {
        if (serviceData?.option != null) e.state = String(serviceData.option);

        // Vacuum
      } else if (key === "vacuum/start") {
        e.state = "cleaning";
      } else if (key === "vacuum/pause") {
        e.state = "paused";
      } else if (key === "vacuum/stop") {
        e.state = "idle";
      } else if (key === "vacuum/return_to_base") {
        e.state = "returning";
      } else if (key === "vacuum/locate") {
        // no-op for mock
        // Scene / script
      } else if (key === "scene/turn_on" || key === "script/turn_on") {
        // no-op for mock
      }

      e.last_updated = new Date().toISOString();
      changed[id] = { ...e, attributes: { ...e.attributes } };
    }

    if (Object.keys(changed).length) {
      for (const cb of this.subs) cb(changed);
    }
  }

  async getDashboards(): Promise<DashboardListItem[]> {
    return [
      {
        url_path: "overview",
        title: "Overview",
        icon: undefined,
        mode: "storage",
        show_in_sidebar: true,
        require_admin: false,
      },
    ];
  }

  async getDashboardConfig(_urlPath?: string): Promise<LovelaceDashboardConfig> {
    return DEMO_DASHBOARD;
  }

  async saveDashboardConfig(_urlPath: string, _config: LovelaceDashboardConfig): Promise<void> {}
}
