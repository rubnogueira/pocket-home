import { View, Text, Focusable } from "@pocketjs/framework/components";
import { computed } from "vue";
import type { ThermostatCardConfig } from "../types/card.ts";
import type { EntityState, HassEntity } from "../types/entity.ts";
import { entityName } from "../store/entity-store.ts";
import { useMoreInfo } from "../store/more-info-context.ts";
import type { DataSource } from "../store/data-source.ts";
import { HA_CARD_PRESS_GAP3 } from "../ui/tokens.ts";
import FeatureRenderer from "../renderer/FeatureRenderer.tsx";
import { ICON_BTN, SURFACE_INSET } from "../ui/tokens.ts";

export interface ThermostatCardProps {
  config: ThermostatCardConfig;
  entities: EntityState;
  source: DataSource;
}

export default function ThermostatCard(props: ThermostatCardProps) {
  const showMoreInfo = useMoreInfo();
  const entity = computed(() => props.entities[props.config.entity] as HassEntity | undefined);
  const name = computed(() => props.config.name ?? entityName(entity.value, props.config.entity));
  const target = computed(() => entity.value?.attributes.temperature as number | undefined);
  const current = computed(
    () => entity.value?.attributes.current_temperature as number | undefined,
  );
  const humidity = computed(() => entity.value?.attributes.current_humidity as number | undefined);
  const mode = computed(() => entity.value?.state ?? "off");
  const features = props.config.features ?? [];

  function adjustTemp(delta: number) {
    if (!entity.value || target.value == null) return;
    const next = target.value + delta;
    props.source.callService(
      "climate",
      "set_temperature",
      { temperature: next },
      { entity_id: entity.value.entity_id },
    );
  }

  function handleTap() {
    if (entity.value) showMoreInfo(entity.value.entity_id);
  }

  return (
    <Focusable class={HA_CARD_PRESS_GAP3} onPress={handleTap}>
      <Text class="text-sm text-slate-100 font-bold">{name.value}</Text>

      <View class="flex-row items-center justify-between">
        <View class="flex-col">
          <View class="flex-row items-end gap-1">
            <Text class="text-4xl text-slate-50 font-bold">
              {target.value != null ? String(target.value) : "—"}
            </Text>
            <Text class="text-xl text-slate-400 pb-1">{"\u00b0"}</Text>
          </View>
          <Text class="text-xs text-slate-500">Target</Text>
        </View>
        <View class="flex-col gap-2">
          <Focusable class={ICON_BTN} onPress={() => adjustTemp(0.5)}>
            <Text class="text-lg text-slate-300 font-bold">+</Text>
          </Focusable>
          <Focusable class={ICON_BTN} onPress={() => adjustTemp(-0.5)}>
            <Text class="text-lg text-slate-300 font-bold">-</Text>
          </Focusable>
        </View>
      </View>

      <View class="flex-row gap-3">
        <View class={SURFACE_INSET}>
          <Text class="text-lg text-cyan-400 font-bold">
            {current.value != null ? `${current.value}\u00b0` : "—"}
          </Text>
          <Text class="text-xs text-slate-500">Current</Text>
        </View>
        <View class={SURFACE_INSET}>
          <Text class="text-lg text-blue-400 font-bold">
            {humidity.value != null ? `${humidity.value}%` : "—"}
          </Text>
          <Text class="text-xs text-slate-500">Humidity</Text>
        </View>
        <View class={SURFACE_INSET}>
          <Text class="text-lg text-emerald-400 font-bold">{mode.value}</Text>
          <Text class="text-xs text-slate-500">Mode</Text>
        </View>
      </View>

      {features.length > 0 ? (
        <View class="flex-col gap-1">
          {features.map((f, i) => (
            <FeatureRenderer
              key={`f-${i}`}
              config={f}
              entity={entity.value}
              source={props.source}
            />
          ))}
        </View>
      ) : null}
    </Focusable>
  );
}
