import { Text, Focusable } from "@pocketjs/framework/components";
import { computed } from "vue";
import type { EntityRowConfig } from "../types/row.ts";
import type { EntityState, HassEntity } from "../types/entity.ts";
import { entityName, entityStateDisplay } from "../store/entity-store.ts";
import { useMoreInfo } from "../store/more-info-context.ts";
import type { DataSource } from "../store/data-source.ts";

export interface SensorEntityRowProps {
  config: EntityRowConfig;
  entities: EntityState;
  source: DataSource;
}

export default function SensorEntityRow(props: SensorEntityRowProps) {
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
  const state = computed(() => entityStateDisplay(entity.value));

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
      <Text class="text-sm text-slate-100 font-bold">{state.value}</Text>
    </Focusable>
  );
}
