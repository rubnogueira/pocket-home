import { View, Text, Focusable } from "@pocketjs/framework/components";
import { computed } from "vue";
import type { EntityRowConfig } from "../types/row.ts";
import type { EntityState, HassEntity } from "../types/entity.ts";
import { entityName } from "../store/entity-store.ts";
import { useMoreInfo } from "../store/more-info-context.ts";
import type { DataSource } from "../store/data-source.ts";

export interface ClimateEntityRowProps {
  config: EntityRowConfig;
  entities: EntityState;
  source: DataSource;
}

export default function ClimateEntityRow(props: ClimateEntityRowProps) {
  const showMoreInfo = useMoreInfo();
  const entity = computed(
    () =>
      (props.config.entity ? props.entities[props.config.entity] : undefined) as
        | HassEntity
        | undefined,
  );
  const name = computed(
    () => props.config.name ?? entityName(entity.value, props.config.entity ?? ""),
  );
  const temp = computed(() => entity.value?.attributes.temperature);
  const mode = computed(() => entity.value?.state ?? "off");

  function handleTap() {
    if (props.config.entity) showMoreInfo(props.config.entity);
  }

  return (
    <Focusable
      class="flex-row items-center justify-between px-3 py-2 focus:bg-slate-700 active:bg-slate-600"
      onPress={handleTap}
    >
      <Text class="text-sm text-slate-200" style={{ maxLines: 1 }}>
        {name.value}
      </Text>
      <View class="flex-row items-center gap-2">
        <Text class="text-sm text-cyan-400 font-bold">
          {temp.value != null ? `${temp.value}\u00b0` : "—"}
        </Text>
        <Text class="text-xs text-slate-500">{mode.value}</Text>
      </View>
    </Focusable>
  );
}
