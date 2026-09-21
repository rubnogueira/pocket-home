/**
 * MoreInfoSheet — domain-specific detail overlay for an entity.
 * Renders inside a Sheet; no own header (Sheet provides title + close).
 *
 * Matches Home Assistant more-info dialog controls per domain:
 *   light, climate, media_player, cover, lock, switch, input_boolean,
 *   fan, alarm_control_panel, automation, scene, script, vacuum, update,
 *   sensor, binary_sensor, person, device_tracker, weather, and fallback.
 */

import { View, Text, Focusable } from "@pocketjs/framework/components";
import { onFrame } from "@pocketjs/framework/lifecycle";
import { ref, computed } from "vue";
import type { HassEntity } from "../types/entity.ts";
import type { EntityState } from "../types/entity.ts";
import { entityDomain, TOGGLE_DOMAINS } from "../types/entity.ts";
import { entityStateDisplay, isEntityOn } from "../store/entity-store.ts";
import type { DataSource } from "../store/data-source.ts";
import { Badge, Separator, Switch, Slider, Progress } from "../ui/index.ts";

export interface MoreInfoSheetProps {
  entityId: string;
  entities: EntityState;
  source: DataSource;
  onClose: () => void;
}

const CTRL_ROW = "flex-row items-center justify-between";
const CTRL_BTN = "px-3 py-2 rounded-lg bg-slate-700 focus:bg-slate-600 active:bg-slate-500";
const CTRL_BTN_ACTIVE = "px-3 py-2 rounded-lg bg-blue-900 focus:bg-blue-800 active:bg-blue-700";
const CTRL_BTN_DANGER = "px-3 py-2 rounded-lg bg-red-900 focus:bg-red-800 active:bg-red-700";
const CTRL_BTN_SUCCESS =
  "px-3 py-2 rounded-lg bg-emerald-900 focus:bg-emerald-800 active:bg-emerald-700";
const SECTION_LABEL = "text-xs text-slate-500 font-bold";

export default function MoreInfoSheet(props: MoreInfoSheetProps) {
  const entity = ref<HassEntity | undefined>(props.entities[props.entityId]);

  onFrame(() => {
    const e = props.entities[props.entityId];
    if (e !== entity.value) entity.value = e;
  });

  const on = computed(() => isEntityOn(entity.value));
  const stateStr = computed(() => entityStateDisplay(entity.value));
  const attrs = computed(() =>
    entity.value ? Object.entries(entity.value.attributes).slice(0, 16) : [],
  );
  const lastChanged = computed(() =>
    entity.value ? formatTimestamp(entity.value.last_changed) : "",
  );
  const lastUpdated = computed(() =>
    entity.value ? formatTimestamp(entity.value.last_updated) : "",
  );

  if (!entity.value) return <View />;

  return (
    <View class="flex-col gap-3 w-full">
      {/* State badge */}
      <View class={CTRL_ROW}>
        <Text class="text-sm text-slate-300">State</Text>
        <Badge label={stateStr.value} variant={on.value ? "success" : "default"} />
      </View>

      <Separator />

      {/* Domain-specific controls — re-created when entity changes */}
      {entity.value ? renderDomainControls(entity.value, props.source) : null}

      {/* Attributes */}
      <Separator />
      <Text class={SECTION_LABEL}>Attributes</Text>
      <View class="flex-col gap-1">
        {attrs.value.map(([key, val]) => (
          <View key={key} class="flex-col gap-1 px-1 w-full">
            <Text class="text-xs text-slate-400">{key}</Text>
            <Text class="text-xs text-slate-300 w-full">{formatAttrValue(val)}</Text>
          </View>
        ))}
      </View>

      {/* Last changed */}
      <Separator />
      <View class="flex-col gap-1 px-1 w-full">
        <Text class="text-xs text-slate-500">Last changed</Text>
        <Text class="text-xs text-slate-400 w-full">{lastChanged.value}</Text>
      </View>
      <View class="flex-col gap-1 px-1 w-full">
        <Text class="text-xs text-slate-500">Last updated</Text>
        <Text class="text-xs text-slate-400 w-full">{lastUpdated.value}</Text>
      </View>
    </View>
  );
}

function formatAttrValue(val: unknown): string {
  if (val == null) return "—";
  if (typeof val === "boolean") return val ? "true" : "false";
  if (Array.isArray(val)) return val.join(", ").slice(0, 40);
  if (typeof val === "object") return JSON.stringify(val).slice(0, 40);
  return String(val).slice(0, 40);
}

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
  } catch {
    return iso;
  }
}

function renderDomainControls(e: HassEntity, source: DataSource) {
  const domain = entityDomain(e.entity_id);

  switch (domain) {
    case "light":
      return <LightControls entity={e} source={source} />;
    case "climate":
      return <ClimateControls entity={e} source={source} />;
    case "media_player":
      return <MediaPlayerControls entity={e} source={source} />;
    case "cover":
      return <CoverControls entity={e} source={source} />;
    case "lock":
      return <LockControls entity={e} source={source} />;
    case "fan":
      return <FanControls entity={e} source={source} />;
    case "alarm_control_panel":
      return <AlarmControls entity={e} source={source} />;
    case "automation":
      return <AutomationControls entity={e} source={source} />;
    case "scene":
      return <SceneControls entity={e} source={source} />;
    case "script":
      return <ScriptControls entity={e} source={source} />;
    case "vacuum":
      return <VacuumControls entity={e} source={source} />;
    case "update":
      return <UpdateControls entity={e} source={source} />;
    case "weather":
      return <WeatherControls entity={e} source={source} />;
    case "sensor":
      return <SensorControls entity={e} source={source} />;
    case "binary_sensor":
      return <BinarySensorControls entity={e} source={source} />;
    case "person":
    case "device_tracker":
      return <TrackerControls entity={e} source={source} />;
    case "switch":
    case "input_boolean":
      return <SwitchControls entity={e} source={source} />;
    default:
      if (TOGGLE_DOMAINS.has(domain)) return <SwitchControls entity={e} source={source} />;
      return <GenericControls entity={e} source={source} />;
  }
}

interface DomainProps {
  entity: HassEntity;
  source: DataSource;
}

/* ── Light ───────────────────────────────────────────────────────── */

function LightControls(props: DomainProps) {
  const e = props.entity;
  const on = e.state === "on";
  const brightness = (e.attributes.brightness as number) ?? 0;
  const bPct = Math.round((brightness / 255) * 100);
  const colorTemp = e.attributes.color_temp as number | undefined;
  const minMireds = (e.attributes.min_mireds as number) ?? 153;
  const maxMireds = (e.attributes.max_mireds as number) ?? 500;
  const supportedFeatures = (e.attributes.supported_features as number) ?? 0;
  const supportsBrightness =
    (supportedFeatures & 1) !== 0 || brightness > 0 || (supportedFeatures & 32) !== 0;
  const supportsColorTemp =
    (supportedFeatures & 2) !== 0 || colorTemp != null || (supportedFeatures & 4) !== 0;
  const effects = e.attributes.effect_list as string[] | undefined;
  const currentEffect = e.attributes.effect as string | undefined;
  const colorModes = e.attributes.supported_color_modes as string[] | undefined;

  function toggle() {
    const svc = on ? "turn_off" : "turn_on";
    props.source.callService("light", svc, {}, { entity_id: e.entity_id });
  }

  function setBrightness(val: number) {
    const b = Math.max(0, Math.min(255, Math.round(val * 2.55)));
    props.source.callService("light", "turn_on", { brightness: b }, { entity_id: e.entity_id });
  }

  function setColorTemp(val: number) {
    props.source.callService("light", "turn_on", { color_temp: val }, { entity_id: e.entity_id });
  }

  function setEffect(effect: string) {
    props.source.callService("light", "turn_on", { effect }, { entity_id: e.entity_id });
  }

  return (
    <View class="flex-col gap-3">
      <Text class={SECTION_LABEL}>Controls</Text>

      {/* Power toggle */}
      <View class={CTRL_ROW}>
        <Text class="text-sm text-slate-300">Power</Text>
        <Switch checked={on} onPress={toggle} />
      </View>

      {/* Brightness */}
      {on && supportsBrightness ? (
        <View class="flex-col gap-1">
          <View class={CTRL_ROW}>
            <Text class="text-sm text-slate-300">Brightness</Text>
            <Text class="text-sm text-slate-400">{bPct}%</Text>
          </View>
          <Slider value={bPct} min={1} max={100} step={5} onValueChange={setBrightness} />
        </View>
      ) : null}

      {/* Color temperature */}
      {on && supportsColorTemp && colorTemp != null ? (
        <View class="flex-col gap-1">
          <View class={CTRL_ROW}>
            <Text class="text-sm text-slate-300">Color temp</Text>
            <Text class="text-sm text-slate-400">{colorTemp} mireds</Text>
          </View>
          <Slider
            value={colorTemp}
            min={minMireds}
            max={maxMireds}
            step={10}
            onValueChange={setColorTemp}
          />
        </View>
      ) : null}

      {/* Color mode info */}
      {on && colorModes?.length ? (
        <View class={CTRL_ROW}>
          <Text class="text-sm text-slate-300">Color mode</Text>
          <Text class="text-sm text-slate-400">
            {(e.attributes.color_mode as string) ?? "unknown"}
          </Text>
        </View>
      ) : null}

      {/* Effects */}
      {on && effects?.length ? (
        <View class="flex-col gap-1">
          <Text class="text-sm text-slate-300">Effect</Text>
          <View class="flex-row gap-1 flex-wrap">
            {effects.map((fx) => (
              <Focusable
                key={fx}
                class={fx === currentEffect ? CTRL_BTN_ACTIVE : CTRL_BTN}
                onPress={() => setEffect(fx)}
              >
                <Text
                  class={
                    fx === currentEffect
                      ? "text-xs text-blue-300 font-bold"
                      : "text-xs text-slate-300"
                  }
                >
                  {fx}
                </Text>
              </Focusable>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

/* ── Climate ─────────────────────────────────────────────────────── */

function ClimateControls(props: DomainProps) {
  const e = props.entity;
  const target = (e.attributes.temperature as number) ?? 20;
  const current = e.attributes.current_temperature as number | undefined;
  const humidity = e.attributes.current_humidity as number | undefined;
  const hvacModes = (e.attributes.hvac_modes as string[]) ?? ["off", "heat", "cool", "auto"];
  const currentMode = e.state;
  const hvacAction = e.attributes.hvac_action as string | undefined;
  const step = (e.attributes.target_temp_step as number) ?? 0.5;
  const minTemp = (e.attributes.min_temp as number) ?? 5;
  const maxTemp = (e.attributes.max_temp as number) ?? 35;
  const fanModes = e.attributes.fan_modes as string[] | undefined;
  const fanMode = e.attributes.fan_mode as string | undefined;
  const presetModes = e.attributes.preset_modes as string[] | undefined;
  const presetMode = e.attributes.preset_mode as string | undefined;
  const swingModes = e.attributes.swing_modes as string[] | undefined;
  const swingMode = e.attributes.swing_mode as string | undefined;

  function setTemp(val: number) {
    props.source.callService(
      "climate",
      "set_temperature",
      { temperature: val },
      { entity_id: e.entity_id },
    );
  }

  function setHvacMode(mode: string) {
    props.source.callService(
      "climate",
      "set_hvac_mode",
      { hvac_mode: mode },
      { entity_id: e.entity_id },
    );
  }

  function setFanMode(mode: string) {
    props.source.callService(
      "climate",
      "set_fan_mode",
      { fan_mode: mode },
      { entity_id: e.entity_id },
    );
  }

  function setPresetMode(mode: string) {
    props.source.callService(
      "climate",
      "set_preset_mode",
      { preset_mode: mode },
      { entity_id: e.entity_id },
    );
  }

  function setSwingMode(mode: string) {
    props.source.callService(
      "climate",
      "set_swing_mode",
      { swing_mode: mode },
      { entity_id: e.entity_id },
    );
  }

  return (
    <View class="flex-col gap-3">
      <Text class={SECTION_LABEL}>Controls</Text>

      {/* Target temperature */}
      <View class="flex-col gap-1">
        <View class={CTRL_ROW}>
          <Text class="text-sm text-slate-300">Target</Text>
          <Text class="text-lg text-cyan-400 font-bold">
            {target}
            {"\u00b0"}
          </Text>
        </View>
        <Slider value={target} min={minTemp} max={maxTemp} step={step} onValueChange={setTemp} />
      </View>

      {/* Current temperature & humidity */}
      <View class="flex-row gap-4">
        {current != null ? (
          <View class="flex-col items-center flex-1 py-2 rounded-xl bg-slate-800">
            <Text class="text-lg text-slate-100 font-bold">
              {current}
              {"\u00b0"}
            </Text>
            <Text class="text-xs text-slate-500">Current</Text>
          </View>
        ) : null}
        {humidity != null ? (
          <View class="flex-col items-center flex-1 py-2 rounded-xl bg-slate-800">
            <Text class="text-lg text-blue-400 font-bold">{humidity}%</Text>
            <Text class="text-xs text-slate-500">Humidity</Text>
          </View>
        ) : null}
        {hvacAction ? (
          <View class="flex-col items-center flex-1 py-2 rounded-xl bg-slate-800">
            <Text class="text-lg text-amber-400 font-bold">{hvacAction}</Text>
            <Text class="text-xs text-slate-500">Action</Text>
          </View>
        ) : null}
      </View>

      {/* HVAC modes */}
      <View class="flex-col gap-1">
        <Text class="text-sm text-slate-300">HVAC mode</Text>
        <View class="flex-row gap-1 flex-wrap">
          {hvacModes.map((mode) => (
            <Focusable
              key={mode}
              class={mode === currentMode ? CTRL_BTN_ACTIVE : CTRL_BTN}
              onPress={() => setHvacMode(mode)}
            >
              <Text
                class={
                  mode === currentMode
                    ? "text-xs text-blue-300 font-bold"
                    : "text-xs text-slate-300"
                }
              >
                {mode}
              </Text>
            </Focusable>
          ))}
        </View>
      </View>

      {/* Fan modes */}
      {fanModes?.length ? (
        <View class="flex-col gap-1">
          <Text class="text-sm text-slate-300">Fan mode</Text>
          <View class="flex-row gap-1 flex-wrap">
            {fanModes.map((mode) => (
              <Focusable
                key={mode}
                class={mode === fanMode ? CTRL_BTN_ACTIVE : CTRL_BTN}
                onPress={() => setFanMode(mode)}
              >
                <Text
                  class={
                    mode === fanMode ? "text-xs text-blue-300 font-bold" : "text-xs text-slate-300"
                  }
                >
                  {mode}
                </Text>
              </Focusable>
            ))}
          </View>
        </View>
      ) : null}

      {/* Preset modes */}
      {presetModes?.length ? (
        <View class="flex-col gap-1">
          <Text class="text-sm text-slate-300">Preset</Text>
          <View class="flex-row gap-1 flex-wrap">
            {presetModes.map((mode) => (
              <Focusable
                key={mode}
                class={mode === presetMode ? CTRL_BTN_ACTIVE : CTRL_BTN}
                onPress={() => setPresetMode(mode)}
              >
                <Text
                  class={
                    mode === presetMode
                      ? "text-xs text-blue-300 font-bold"
                      : "text-xs text-slate-300"
                  }
                >
                  {mode}
                </Text>
              </Focusable>
            ))}
          </View>
        </View>
      ) : null}

      {/* Swing modes */}
      {swingModes?.length ? (
        <View class="flex-col gap-1">
          <Text class="text-sm text-slate-300">Swing</Text>
          <View class="flex-row gap-1 flex-wrap">
            {swingModes.map((mode) => (
              <Focusable
                key={mode}
                class={mode === swingMode ? CTRL_BTN_ACTIVE : CTRL_BTN}
                onPress={() => setSwingMode(mode)}
              >
                <Text
                  class={
                    mode === swingMode
                      ? "text-xs text-blue-300 font-bold"
                      : "text-xs text-slate-300"
                  }
                >
                  {mode}
                </Text>
              </Focusable>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

/* ── Media Player ────────────────────────────────────────────────── */

function MediaPlayerControls(props: DomainProps) {
  const e = props.entity;
  const playing = e.state === "playing";
  const title = e.attributes.media_title as string | undefined;
  const artist = e.attributes.media_artist as string | undefined;
  const album = e.attributes.media_album_name as string | undefined;
  const vol = (e.attributes.volume_level as number) ?? 0;
  const volPct = Math.round(vol * 100);
  const muted = (e.attributes.is_volume_muted as boolean) ?? false;
  const sources = e.attributes.source_list as string[] | undefined;
  const currentSource = e.attributes.source as string | undefined;
  const soundModes = e.attributes.sound_mode_list as string[] | undefined;
  const currentSoundMode = e.attributes.sound_mode as string | undefined;
  const shuffle = e.attributes.shuffle as boolean | undefined;
  const repeat = e.attributes.repeat as string | undefined;

  function svc(service: string, data?: Record<string, unknown>) {
    props.source.callService("media_player", service, data, { entity_id: e.entity_id });
  }

  function setVolume(val: number) {
    svc("volume_set", { volume_level: val / 100 });
  }

  function setSource(source: string) {
    svc("select_source", { source });
  }

  function setSoundMode(mode: string) {
    svc("select_sound_mode", { sound_mode: mode });
  }

  return (
    <View class="flex-col gap-3">
      <Text class={SECTION_LABEL}>Now playing</Text>

      {/* Media info */}
      {title ? (
        <View class="flex-col gap-1 px-1">
          <Text class="text-sm text-slate-100 font-bold" style={{ maxLines: 2 }}>
            {title}
          </Text>
          {artist ? <Text class="text-xs text-slate-400">{artist}</Text> : null}
          {album ? <Text class="text-xs text-slate-500">{album}</Text> : null}
        </View>
      ) : (
        <Text class="text-xs text-slate-500 px-1">{e.state}</Text>
      )}

      {/* Playback controls */}
      <View class="flex-row gap-2 items-center justify-center py-1">
        {shuffle != null ? (
          <Focusable
            class={
              shuffle
                ? "w-8 h-8 rounded-full bg-blue-900 items-center justify-center focus:bg-blue-800 active:bg-blue-700"
                : "w-8 h-8 rounded-full bg-slate-700 items-center justify-center focus:bg-slate-600 active:bg-slate-500"
            }
            onPress={() => svc("shuffle_set", { shuffle: !shuffle })}
          >
            <Text class="text-xs text-slate-300 font-bold">{"\u21C4"}</Text>
          </Focusable>
        ) : null}
        <Focusable
          class="w-8 h-8 rounded-full bg-slate-700 items-center justify-center focus:bg-slate-600 active:bg-slate-500"
          onPress={() => svc("media_previous_track")}
        >
          <Text class="text-xs text-slate-300 font-bold">{"\u23EE"}</Text>
        </Focusable>
        <Focusable
          class="w-12 h-12 rounded-full bg-blue-600 items-center justify-center focus:bg-blue-500 active:bg-blue-500"
          onPress={() => svc("media_play_pause")}
        >
          <Text class="text-sm text-white font-bold">{playing ? "\u23F8" : "\u25B6"}</Text>
        </Focusable>
        <Focusable
          class="w-8 h-8 rounded-full bg-slate-700 items-center justify-center focus:bg-slate-600 active:bg-slate-500"
          onPress={() => svc("media_next_track")}
        >
          <Text class="text-xs text-slate-300 font-bold">{"\u23ED"}</Text>
        </Focusable>
        {repeat != null ? (
          <Focusable
            class={
              repeat !== "off"
                ? "w-8 h-8 rounded-full bg-blue-900 items-center justify-center focus:bg-blue-800 active:bg-blue-700"
                : "w-8 h-8 rounded-full bg-slate-700 items-center justify-center focus:bg-slate-600 active:bg-slate-500"
            }
            onPress={() => {
              const modes = ["off", "all", "one"];
              const idx = modes.indexOf(repeat ?? "off");
              svc("repeat_set", { repeat: modes[(idx + 1) % modes.length] });
            }}
          >
            <Text class="text-xs text-slate-300 font-bold">{"\u21BB"}</Text>
          </Focusable>
        ) : null}
      </View>

      {/* Volume */}
      <View class="flex-col gap-1">
        <View class={CTRL_ROW}>
          <View class="flex-row items-center gap-2">
            <Text class="text-sm text-slate-300">Volume</Text>
            <Focusable
              class={
                muted
                  ? "px-2 py-1 rounded-lg bg-red-900 focus:bg-red-800 active:bg-red-700"
                  : "px-2 py-1 rounded-lg bg-slate-700 focus:bg-slate-600 active:bg-slate-500"
              }
              onPress={() => svc("volume_mute", { is_volume_muted: !muted })}
            >
              <Text class="text-xs text-slate-300 font-bold">{muted ? "Muted" : "Mute"}</Text>
            </Focusable>
          </View>
          <Text class="text-sm text-slate-400">{volPct}%</Text>
        </View>
        <Slider value={volPct} min={0} max={100} step={5} onValueChange={(v) => setVolume(v)} />
      </View>

      {/* Power toggle */}
      <View class={CTRL_ROW}>
        <Text class="text-sm text-slate-300">Power</Text>
        <Switch
          checked={e.state !== "off" && e.state !== "unavailable"}
          onPress={() => svc(e.state === "off" ? "turn_on" : "turn_off")}
        />
      </View>

      {/* Source */}
      {sources?.length ? (
        <View class="flex-col gap-1">
          <Text class="text-sm text-slate-300">Source</Text>
          <View class="flex-row gap-1 flex-wrap">
            {sources.map((src) => (
              <Focusable
                key={src}
                class={src === currentSource ? CTRL_BTN_ACTIVE : CTRL_BTN}
                onPress={() => setSource(src)}
              >
                <Text
                  class={
                    src === currentSource
                      ? "text-xs text-blue-300 font-bold"
                      : "text-xs text-slate-300"
                  }
                >
                  {src}
                </Text>
              </Focusable>
            ))}
          </View>
        </View>
      ) : null}

      {/* Sound mode */}
      {soundModes?.length ? (
        <View class="flex-col gap-1">
          <Text class="text-sm text-slate-300">Sound mode</Text>
          <View class="flex-row gap-1 flex-wrap">
            {soundModes.map((mode) => (
              <Focusable
                key={mode}
                class={mode === currentSoundMode ? CTRL_BTN_ACTIVE : CTRL_BTN}
                onPress={() => setSoundMode(mode)}
              >
                <Text
                  class={
                    mode === currentSoundMode
                      ? "text-xs text-blue-300 font-bold"
                      : "text-xs text-slate-300"
                  }
                >
                  {mode}
                </Text>
              </Focusable>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

/* ── Cover ───────────────────────────────────────────────────────── */

function CoverControls(props: DomainProps) {
  const e = props.entity;
  const isOpen = e.state === "open";
  const position = e.attributes.current_position as number | undefined;
  const tiltPosition = e.attributes.current_tilt_position as number | undefined;
  const supportedFeatures = (e.attributes.supported_features as number) ?? 0;
  const supportsPosition = (supportedFeatures & 4) !== 0 || position != null;
  const supportsTilt = (supportedFeatures & 128) !== 0 || tiltPosition != null;

  function svc(service: string, data?: Record<string, unknown>) {
    props.source.callService("cover", service, data, { entity_id: e.entity_id });
  }

  function setPosition(val: number) {
    svc("set_cover_position", { position: val });
  }

  function setTiltPosition(val: number) {
    svc("set_cover_tilt_position", { tilt_position: val });
  }

  return (
    <View class="flex-col gap-3">
      <Text class={SECTION_LABEL}>Controls</Text>

      {/* Open/Close/Stop buttons */}
      <View class="flex-row gap-2 justify-center">
        <Focusable class={isOpen ? CTRL_BTN_ACTIVE : CTRL_BTN} onPress={() => svc("open_cover")}>
          <Text class="text-xs text-slate-300 font-bold">{"\u25B2"} Open</Text>
        </Focusable>
        <Focusable class={CTRL_BTN} onPress={() => svc("stop_cover")}>
          <Text class="text-xs text-slate-300 font-bold">{"\u25A0"} Stop</Text>
        </Focusable>
        <Focusable class={!isOpen ? CTRL_BTN_ACTIVE : CTRL_BTN} onPress={() => svc("close_cover")}>
          <Text class="text-xs text-slate-300 font-bold">{"\u25BC"} Close</Text>
        </Focusable>
      </View>

      {/* Position slider */}
      {supportsPosition && position != null ? (
        <View class="flex-col gap-1">
          <View class={CTRL_ROW}>
            <Text class="text-sm text-slate-300">Position</Text>
            <Text class="text-sm text-slate-400">{position}%</Text>
          </View>
          <Slider value={position} min={0} max={100} step={5} onValueChange={setPosition} />
        </View>
      ) : null}

      {/* Tilt slider */}
      {supportsTilt && tiltPosition != null ? (
        <View class="flex-col gap-1">
          <View class={CTRL_ROW}>
            <Text class="text-sm text-slate-300">Tilt</Text>
            <Text class="text-sm text-slate-400">{tiltPosition}%</Text>
          </View>
          <Slider value={tiltPosition} min={0} max={100} step={5} onValueChange={setTiltPosition} />
        </View>
      ) : null}
    </View>
  );
}

/* ── Lock ────────────────────────────────────────────────────────── */

function LockControls(props: DomainProps) {
  const e = props.entity;
  const locked = e.state === "locked";
  const locking = e.attributes.is_locking as boolean | undefined;
  const unlocking = e.attributes.is_unlocking as boolean | undefined;
  const jammed = e.attributes.is_jammed as boolean | undefined;

  function svc(service: string) {
    props.source.callService("lock", service, {}, { entity_id: e.entity_id });
  }

  return (
    <View class="flex-col gap-3">
      <Text class={SECTION_LABEL}>Controls</Text>

      {jammed ? (
        <View class="px-3 py-2 rounded-lg bg-red-900">
          <Text class="text-xs text-red-300 font-bold">Lock is jammed!</Text>
        </View>
      ) : null}

      {locking ? <Text class="text-xs text-slate-400">Locking...</Text> : null}
      {unlocking ? <Text class="text-xs text-slate-400">Unlocking...</Text> : null}

      <View class="flex-row gap-2 justify-center">
        <Focusable class={locked ? CTRL_BTN_SUCCESS : CTRL_BTN} onPress={() => svc("lock")}>
          <Text
            class={
              locked ? "text-sm text-emerald-300 font-bold" : "text-sm text-slate-300 font-bold"
            }
          >
            {"\uD83D\uDD12"} Lock
          </Text>
        </Focusable>
        <Focusable class={!locked ? CTRL_BTN_DANGER : CTRL_BTN} onPress={() => svc("unlock")}>
          <Text
            class={!locked ? "text-sm text-red-300 font-bold" : "text-sm text-slate-300 font-bold"}
          >
            {"\uD83D\uDD13"} Unlock
          </Text>
        </Focusable>
      </View>
    </View>
  );
}

/* ── Fan ─────────────────────────────────────────────────────────── */

function FanControls(props: DomainProps) {
  const e = props.entity;
  const on = e.state === "on";
  const speed = e.attributes.percentage as number | undefined;
  const presetModes = e.attributes.preset_modes as string[] | undefined;
  const presetMode = e.attributes.preset_mode as string | undefined;
  const oscillating = e.attributes.oscillating as boolean | undefined;
  const direction = e.attributes.direction as string | undefined;

  function toggle() {
    props.source.callService("fan", on ? "turn_off" : "turn_on", {}, { entity_id: e.entity_id });
  }

  function setSpeed(val: number) {
    props.source.callService(
      "fan",
      "set_percentage",
      { percentage: val },
      { entity_id: e.entity_id },
    );
  }

  function toggleOscillate() {
    props.source.callService(
      "fan",
      "oscillate",
      { oscillating: !oscillating },
      { entity_id: e.entity_id },
    );
  }

  function toggleDirection() {
    const next = direction === "forward" ? "reverse" : "forward";
    props.source.callService(
      "fan",
      "set_direction",
      { direction: next },
      { entity_id: e.entity_id },
    );
  }

  function setPreset(mode: string) {
    props.source.callService(
      "fan",
      "set_preset_mode",
      { preset_mode: mode },
      { entity_id: e.entity_id },
    );
  }

  return (
    <View class="flex-col gap-3">
      <Text class={SECTION_LABEL}>Controls</Text>

      {/* Power */}
      <View class={CTRL_ROW}>
        <Text class="text-sm text-slate-300">Power</Text>
        <Switch checked={on} onPress={toggle} />
      </View>

      {/* Speed */}
      {on && speed != null ? (
        <View class="flex-col gap-1">
          <View class={CTRL_ROW}>
            <Text class="text-sm text-slate-300">Speed</Text>
            <Text class="text-sm text-slate-400">{speed}%</Text>
          </View>
          <Slider value={speed} min={0} max={100} step={10} onValueChange={setSpeed} />
        </View>
      ) : null}

      {/* Oscillation */}
      {on && oscillating != null ? (
        <View class={CTRL_ROW}>
          <Text class="text-sm text-slate-300">Oscillation</Text>
          <Switch checked={oscillating} onPress={toggleOscillate} />
        </View>
      ) : null}

      {/* Direction */}
      {on && direction != null ? (
        <View class={CTRL_ROW}>
          <Text class="text-sm text-slate-300">Direction</Text>
          <Focusable class={CTRL_BTN} onPress={toggleDirection}>
            <Text class="text-xs text-slate-300 font-bold">
              {direction === "forward" ? "\u21BB Forward" : "\u21BA Reverse"}
            </Text>
          </Focusable>
        </View>
      ) : null}

      {/* Preset modes */}
      {on && presetModes?.length ? (
        <View class="flex-col gap-1">
          <Text class="text-sm text-slate-300">Preset</Text>
          <View class="flex-row gap-1 flex-wrap">
            {presetModes.map((mode) => (
              <Focusable
                key={mode}
                class={mode === presetMode ? CTRL_BTN_ACTIVE : CTRL_BTN}
                onPress={() => setPreset(mode)}
              >
                <Text
                  class={
                    mode === presetMode
                      ? "text-xs text-blue-300 font-bold"
                      : "text-xs text-slate-300"
                  }
                >
                  {mode}
                </Text>
              </Focusable>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

/* ── Alarm Control Panel ─────────────────────────────────────────── */

function AlarmControls(props: DomainProps) {
  const e = props.entity;
  const state = e.state;

  const ARM_SERVICES: Record<string, string> = {
    armed_home: "alarm_arm_home",
    armed_away: "alarm_arm_away",
    armed_night: "alarm_arm_night",
    armed_vacation: "alarm_arm_vacation",
    armed_custom_bypass: "alarm_arm_custom_bypass",
  };

  function arm(mode: string) {
    const svc = ARM_SERVICES[mode] ?? "alarm_arm_home";
    props.source.callService("alarm_control_panel", svc, {}, { entity_id: e.entity_id });
  }

  function disarm() {
    props.source.callService("alarm_control_panel", "alarm_disarm", {}, { entity_id: e.entity_id });
  }

  function trigger() {
    props.source.callService(
      "alarm_control_panel",
      "alarm_trigger",
      {},
      { entity_id: e.entity_id },
    );
  }

  const modeColor = (mode: string) => {
    if (mode === state) return CTRL_BTN_ACTIVE;
    return CTRL_BTN;
  };

  return (
    <View class="flex-col gap-3">
      <Text class={SECTION_LABEL}>Alarm controls</Text>

      {/* Arm modes */}
      <View class="flex-col gap-1">
        <Text class="text-sm text-slate-300">Arm</Text>
        <View class="flex-row gap-1 flex-wrap">
          {Object.keys(ARM_SERVICES).map((mode) => (
            <Focusable key={mode} class={modeColor(mode)} onPress={() => arm(mode)}>
              <Text
                class={
                  mode === state ? "text-xs text-blue-300 font-bold" : "text-xs text-slate-300"
                }
              >
                {mode.replace(/armed_?/g, "").replace(/_/g, " ") || "home"}
              </Text>
            </Focusable>
          ))}
        </View>
      </View>

      {/* Disarm */}
      <View class="flex-row gap-2">
        <Focusable class={state === "disarmed" ? CTRL_BTN_SUCCESS : CTRL_BTN} onPress={disarm}>
          <Text class="text-sm text-slate-300 font-bold">Disarm</Text>
        </Focusable>
      </View>

      {/* Trigger (dangerous) */}
      <Focusable class={CTRL_BTN_DANGER} onPress={trigger}>
        <Text class="text-xs text-red-300 font-bold">Trigger alarm</Text>
      </Focusable>

      {/* Changed by */}
      {e.attributes.changed_by ? (
        <View class={CTRL_ROW}>
          <Text class="text-xs text-slate-500">Changed by</Text>
          <Text class="text-xs text-slate-400">{String(e.attributes.changed_by)}</Text>
        </View>
      ) : null}
    </View>
  );
}

/* ── Automation ──────────────────────────────────────────────────── */

function AutomationControls(props: DomainProps) {
  const e = props.entity;
  const enabled = e.state === "on";

  function toggle() {
    props.source.callService(
      "automation",
      enabled ? "turn_off" : "turn_on",
      {},
      { entity_id: e.entity_id },
    );
  }

  function trigger() {
    props.source.callService("automation", "trigger", {}, { entity_id: e.entity_id });
  }

  return (
    <View class="flex-col gap-3">
      <Text class={SECTION_LABEL}>Automation</Text>

      <View class={CTRL_ROW}>
        <Text class="text-sm text-slate-300">Enabled</Text>
        <Switch checked={enabled} onPress={toggle} />
      </View>

      <Focusable class={CTRL_BTN_ACTIVE} onPress={trigger}>
        <Text class="text-sm text-blue-300 font-bold">Trigger now</Text>
      </Focusable>

      {e.attributes.last_triggered ? (
        <View class={CTRL_ROW}>
          <Text class="text-xs text-slate-500">Last triggered</Text>
          <Text class="text-xs text-slate-400">
            {formatTimestamp(String(e.attributes.last_triggered))}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/* ── Scene ───────────────────────────────────────────────────────── */

function SceneControls(props: DomainProps) {
  const e = props.entity;

  function activate() {
    props.source.callService("scene", "turn_on", {}, { entity_id: e.entity_id });
  }

  return (
    <View class="flex-col gap-3">
      <Text class={SECTION_LABEL}>Scene</Text>
      <Focusable class={CTRL_BTN_ACTIVE} onPress={activate}>
        <Text class="text-sm text-blue-300 font-bold">Activate scene</Text>
      </Focusable>
    </View>
  );
}

/* ── Script ──────────────────────────────────────────────────────── */

function ScriptControls(props: DomainProps) {
  const e = props.entity;

  function run() {
    props.source.callService("script", "turn_on", {}, { entity_id: e.entity_id });
  }

  return (
    <View class="flex-col gap-3">
      <Text class={SECTION_LABEL}>Script</Text>
      <Focusable class={CTRL_BTN_ACTIVE} onPress={run}>
        <Text class="text-sm text-blue-300 font-bold">Run script</Text>
      </Focusable>
    </View>
  );
}

/* ── Vacuum ──────────────────────────────────────────────────────── */

function VacuumControls(props: DomainProps) {
  const e = props.entity;
  const battery = e.attributes.battery_level as number | undefined;

  function svc(service: string) {
    props.source.callService("vacuum", service, {}, { entity_id: e.entity_id });
  }

  return (
    <View class="flex-col gap-3">
      <Text class={SECTION_LABEL}>Vacuum</Text>

      {battery != null ? (
        <View class="flex-col gap-1">
          <View class={CTRL_ROW}>
            <Text class="text-sm text-slate-300">Battery</Text>
            <Text class="text-sm text-slate-400">{battery}%</Text>
          </View>
          <Progress value={battery} max={100} />
        </View>
      ) : null}

      <View class="flex-row gap-2 justify-center flex-wrap">
        <Focusable
          class={e.state === "cleaning" ? CTRL_BTN_ACTIVE : CTRL_BTN}
          onPress={() => svc("start")}
        >
          <Text class="text-xs text-slate-300 font-bold">Start</Text>
        </Focusable>
        <Focusable
          class={e.state === "paused" ? CTRL_BTN_ACTIVE : CTRL_BTN}
          onPress={() => svc("pause")}
        >
          <Text class="text-xs text-slate-300 font-bold">Pause</Text>
        </Focusable>
        <Focusable class={CTRL_BTN} onPress={() => svc("stop")}>
          <Text class="text-xs text-slate-300 font-bold">Stop</Text>
        </Focusable>
        <Focusable
          class={e.state === "returning" ? CTRL_BTN_ACTIVE : CTRL_BTN}
          onPress={() => svc("return_to_base")}
        >
          <Text class="text-xs text-slate-300 font-bold">Return</Text>
        </Focusable>
        <Focusable class={CTRL_BTN} onPress={() => svc("locate")}>
          <Text class="text-xs text-slate-300 font-bold">Locate</Text>
        </Focusable>
      </View>
    </View>
  );
}

/* ── Update ──────────────────────────────────────────────────────── */

function UpdateControls(props: DomainProps) {
  const e = props.entity;
  const installed = e.attributes.installed_version as string | undefined;
  const latest = e.attributes.latest_version as string | undefined;
  const inProgress = e.attributes.in_progress;
  const hasUpdate = installed && latest && installed !== latest;
  const summary = e.attributes.release_summary as string | undefined;

  function install() {
    props.source.callService("update", "install", {}, { entity_id: e.entity_id });
  }

  function skip() {
    props.source.callService("update", "skip", {}, { entity_id: e.entity_id });
  }

  return (
    <View class="flex-col gap-3">
      <Text class={SECTION_LABEL}>Update</Text>

      <View class={CTRL_ROW}>
        <Text class="text-sm text-slate-300">Installed</Text>
        <Text class="text-sm text-slate-100 font-bold">{installed ?? "unknown"}</Text>
      </View>

      <View class={CTRL_ROW}>
        <Text class="text-sm text-slate-300">Latest</Text>
        <Text class="text-sm text-cyan-400 font-bold">{latest ?? "unknown"}</Text>
      </View>

      {inProgress ? (
        <View class="flex-col gap-1">
          <Text class="text-xs text-amber-400">Update in progress...</Text>
          {typeof inProgress === "number" ? <Progress value={inProgress} max={100} /> : null}
        </View>
      ) : null}

      {summary ? (
        <View class="flex-col gap-1">
          <Text class="text-xs text-slate-500">Release notes</Text>
          <Text class="text-xs text-slate-400" style={{ maxLines: 4 }}>
            {summary}
          </Text>
        </View>
      ) : null}

      {hasUpdate && !inProgress ? (
        <View class="flex-row gap-2">
          <Focusable class={CTRL_BTN_ACTIVE} onPress={install}>
            <Text class="text-sm text-blue-300 font-bold">Install</Text>
          </Focusable>
          <Focusable class={CTRL_BTN} onPress={skip}>
            <Text class="text-sm text-slate-300 font-bold">Skip</Text>
          </Focusable>
        </View>
      ) : null}
    </View>
  );
}

/* ── Weather ─────────────────────────────────────────────────────── */

function WeatherControls(props: DomainProps) {
  const e = props.entity;
  const temp = e.attributes.temperature as number | undefined;
  const humidity = e.attributes.humidity as number | undefined;
  const wind = e.attributes.wind_speed as number | undefined;
  const pressure = e.attributes.pressure as number | undefined;
  const forecast = (e.attributes.forecast ?? []) as Array<{
    datetime: string;
    condition?: string;
    temperature?: number;
    templow?: number;
    precipitation_probability?: number;
  }>;

  return (
    <View class="flex-col gap-3">
      <Text class={SECTION_LABEL}>Weather</Text>

      <View class="flex-row gap-3 flex-wrap">
        {temp != null ? (
          <View class="flex-col items-center flex-1 py-2 rounded-xl bg-slate-800">
            <Text class="text-lg text-slate-100 font-bold">
              {temp}
              {"\u00b0"}
            </Text>
            <Text class="text-xs text-slate-500">Temp</Text>
          </View>
        ) : null}
        {humidity != null ? (
          <View class="flex-col items-center flex-1 py-2 rounded-xl bg-slate-800">
            <Text class="text-lg text-blue-400 font-bold">{humidity}%</Text>
            <Text class="text-xs text-slate-500">Humidity</Text>
          </View>
        ) : null}
        {wind != null ? (
          <View class="flex-col items-center flex-1 py-2 rounded-xl bg-slate-800">
            <Text class="text-lg text-slate-300 font-bold">{wind}</Text>
            <Text class="text-xs text-slate-500">Wind</Text>
          </View>
        ) : null}
        {pressure != null ? (
          <View class="flex-col items-center flex-1 py-2 rounded-xl bg-slate-800">
            <Text class="text-lg text-slate-300 font-bold">{pressure}</Text>
            <Text class="text-xs text-slate-500">Pressure</Text>
          </View>
        ) : null}
      </View>

      {forecast.length > 0 ? (
        <View class="flex-col gap-1">
          <Text class="text-sm text-slate-300">Forecast</Text>
          {forecast.slice(0, 5).map((f, i) => {
            const day = f.datetime
              ? new Date(f.datetime).toLocaleDateString("en", { weekday: "short" })
              : `Day ${i + 1}`;
            return (
              <View key={`fc-${i}`} class="flex-row items-center justify-between px-1 py-1">
                <Text class="text-xs text-slate-300" style={{ width: 36 }}>
                  {day}
                </Text>
                <Text class="text-xs text-slate-400">{f.condition ?? ""}</Text>
                <Text class="text-xs text-slate-400">
                  {f.templow != null ? `${f.templow}\u00b0` : ""}
                </Text>
                <Text class="text-xs text-slate-100 font-bold">
                  {f.temperature != null ? `${f.temperature}\u00b0` : "—"}
                </Text>
                {f.precipitation_probability != null ? (
                  <Text class="text-xs text-blue-400">{f.precipitation_probability}%</Text>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

/* ── Sensor ──────────────────────────────────────────────────────── */

function SensorControls(props: DomainProps) {
  const e = props.entity;
  const unit = e.attributes.unit_of_measurement as string | undefined;
  const deviceClass = e.attributes.device_class as string | undefined;
  const stateClass = e.attributes.state_class as string | undefined;

  return (
    <View class="flex-col gap-3">
      <Text class={SECTION_LABEL}>Sensor</Text>

      <View class="flex-col items-center py-4">
        <Text class="text-4xl text-slate-50 font-bold">
          {e.state}
          {unit ? ` ${unit}` : ""}
        </Text>
        {deviceClass ? <Text class="text-xs text-slate-400 pt-1">{deviceClass}</Text> : null}
        {stateClass ? <Text class="text-xs text-slate-500">{stateClass}</Text> : null}
      </View>
    </View>
  );
}

/* ── Binary Sensor ───────────────────────────────────────────────── */

function BinarySensorControls(props: DomainProps) {
  const e = props.entity;
  const deviceClass = e.attributes.device_class as string | undefined;
  const on = e.state === "on";

  const stateLabel = deviceClass
    ? (BINARY_LABELS[deviceClass]?.[on ? 1 : 0] ?? (on ? "Detected" : "Clear"))
    : on
      ? "On"
      : "Off";

  return (
    <View class="flex-col gap-3">
      <Text class={SECTION_LABEL}>Binary sensor</Text>

      <View class="flex-col items-center py-4">
        <Badge label={stateLabel} variant={on ? "warning" : "success"} />
        {deviceClass ? <Text class="text-xs text-slate-400 pt-2">{deviceClass}</Text> : null}
      </View>
    </View>
  );
}

const BINARY_LABELS: Record<string, [string, string]> = {
  battery: ["Normal", "Low"],
  cold: ["Normal", "Cold"],
  connectivity: ["Disconnected", "Connected"],
  door: ["Closed", "Open"],
  garage_door: ["Closed", "Open"],
  gas: ["Clear", "Detected"],
  heat: ["Normal", "Hot"],
  light: ["No light", "Light"],
  lock: ["Locked", "Unlocked"],
  moisture: ["Dry", "Wet"],
  motion: ["Clear", "Detected"],
  moving: ["Not moving", "Moving"],
  occupancy: ["Clear", "Detected"],
  opening: ["Closed", "Open"],
  plug: ["Unplugged", "Plugged in"],
  power: ["No power", "Power"],
  presence: ["Away", "Home"],
  problem: ["OK", "Problem"],
  running: ["Not running", "Running"],
  safety: ["Safe", "Unsafe"],
  smoke: ["Clear", "Detected"],
  sound: ["Clear", "Detected"],
  tamper: ["Clear", "Detected"],
  update: ["Up-to-date", "Update available"],
  vibration: ["Clear", "Detected"],
  window: ["Closed", "Open"],
};

/* ── Person / Device Tracker ─────────────────────────────────────── */

function TrackerControls(props: DomainProps) {
  const e = props.entity;
  const lat = e.attributes.latitude as number | undefined;
  const lon = e.attributes.longitude as number | undefined;
  const gps = e.attributes.gps_accuracy as number | undefined;

  return (
    <View class="flex-col gap-3">
      <Text class={SECTION_LABEL}>Location</Text>

      <View class="flex-col items-center py-4">
        <Badge
          label={e.state.replace(/_/g, " ")}
          variant={e.state === "home" ? "success" : "default"}
        />
      </View>

      {lat != null && lon != null ? (
        <View class="flex-col gap-1">
          <View class={CTRL_ROW}>
            <Text class="text-xs text-slate-500">Latitude</Text>
            <Text class="text-xs text-slate-300">{lat.toFixed(4)}</Text>
          </View>
          <View class={CTRL_ROW}>
            <Text class="text-xs text-slate-500">Longitude</Text>
            <Text class="text-xs text-slate-300">{lon.toFixed(4)}</Text>
          </View>
          {gps != null ? (
            <View class={CTRL_ROW}>
              <Text class="text-xs text-slate-500">GPS accuracy</Text>
              <Text class="text-xs text-slate-300">{gps} m</Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/* ── Switch / Input Boolean ──────────────────────────────────────── */

function SwitchControls(props: DomainProps) {
  const e = props.entity;
  const domain = entityDomain(e.entity_id);
  const on = isEntityOn(e);
  const svcDomain = TOGGLE_DOMAINS.has(domain) ? domain : "homeassistant";

  function toggle() {
    props.source.callService(
      svcDomain,
      on ? "turn_off" : "turn_on",
      {},
      { entity_id: e.entity_id },
    );
  }

  return (
    <View class="flex-col gap-3">
      <Text class={SECTION_LABEL}>Controls</Text>

      <View class={CTRL_ROW}>
        <Text class="text-sm text-slate-300">Power</Text>
        <Switch checked={on} onPress={toggle} />
      </View>
    </View>
  );
}

/* ── Generic (fallback) ──────────────────────────────────────────── */

function GenericControls(props: DomainProps) {
  const e = props.entity;
  const unit = e.attributes.unit_of_measurement as string | undefined;

  return (
    <View class="flex-col gap-3">
      <View class="flex-col items-center py-3">
        <Text class="text-2xl text-slate-100 font-bold">
          {e.state}
          {unit ? ` ${unit}` : ""}
        </Text>
      </View>
    </View>
  );
}
