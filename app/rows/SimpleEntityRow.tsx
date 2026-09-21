import { View, Text, Focusable } from "@pocketjs/framework/components";
import { computed } from "vue";
import type { EntityRowConfig } from "../types/row.ts";
import type { EntityState, HassEntity } from "../types/entity.ts";
import { entityName, entityStateDisplay, isEntityOn } from "../store/entity-store.ts";
import { useMoreInfo } from "../store/more-info-context.ts";
import type { DataSource } from "../store/data-source.ts";

export interface SimpleEntityRowProps {
  config: EntityRowConfig;
  entities: EntityState;
  source: DataSource;
}

export default function SimpleEntityRow(props: SimpleEntityRowProps) {
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
  const on = computed(() => isEntityOn(entity.value));

  function handleTap() {
    if (props.config.entity) showMoreInfo(props.config.entity);
  }

  return (
    <Focusable
      class="flex-row items-center justify-between px-3 py-2 focus:bg-slate-700 active:bg-slate-600"
      onPress={handleTap}
    >
      <View class="flex-row items-center gap-2 flex-1">
        <View
          class={
            on.value ? "w-2 h-2 rounded-full bg-amber-400" : "w-2 h-2 rounded-full bg-slate-600"
          }
        />
        <Text class="text-sm text-slate-200" style={{ maxLines: 1 }}>
          {name.value}
        </Text>
      </View>
      <Text class="text-sm text-slate-400">{state.value}</Text>
    </Focusable>
  );
}
