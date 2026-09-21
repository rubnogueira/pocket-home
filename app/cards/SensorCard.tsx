import { View, Text, Focusable } from "@pocketjs/framework/components";
import { computed } from "vue";
import type { SensorCardConfig } from "../types/card.ts";
import type { EntityState, HassEntity } from "../types/entity.ts";
import { entityName } from "../store/entity-store.ts";
import { useMoreInfo } from "../store/more-info-context.ts";
import type { DataSource } from "../store/data-source.ts";
import { HA_CARD_PRESS_GAP1 } from "../ui/tokens.ts";

export interface SensorCardProps {
  config: SensorCardConfig;
  entities: EntityState;
  source: DataSource;
}

export default function SensorCard(props: SensorCardProps) {
  const showMoreInfo = useMoreInfo();
  const entity = computed(() => props.entities[props.config.entity] as HassEntity | undefined);
  const name = computed(() => props.config.name ?? entityName(entity.value, props.config.entity));
  const unit = computed(
    () =>
      props.config.unit ??
      (entity.value?.attributes.unit_of_measurement as string | undefined) ??
      "",
  );
  const value = computed(() => entity.value?.state ?? "\u2014");
  const deviceClass = computed(
    () => (entity.value?.attributes.device_class as string | undefined) ?? "",
  );

  function handleTap() {
    showMoreInfo(props.config.entity);
  }

  return (
    <Focusable class={HA_CARD_PRESS_GAP1} onPress={handleTap}>
      <Text class="text-sm text-slate-100 font-bold" style={{ maxLines: 1 }}>
        {name.value}
      </Text>
      <View class="flex-row items-baseline gap-1">
        <Text class="text-2xl text-slate-50 font-bold">{value.value}</Text>
        {unit.value ? <Text class="text-sm text-slate-400">{unit.value}</Text> : null}
      </View>
      {deviceClass.value ? <Text class="text-xs text-slate-500">{deviceClass.value}</Text> : null}
    </Focusable>
  );
}
