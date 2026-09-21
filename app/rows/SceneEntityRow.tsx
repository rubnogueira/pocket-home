import { View, Text, Focusable } from "@pocketjs/framework/components";
import { computed } from "vue";
import type { EntityRowConfig } from "../types/row.ts";
import type { EntityState, HassEntity } from "../types/entity.ts";
import { entityName } from "../store/entity-store.ts";
import { useMoreInfo } from "../store/more-info-context.ts";
import type { DataSource } from "../store/data-source.ts";

export interface SceneEntityRowProps {
  config: EntityRowConfig;
  entities: EntityState;
  source: DataSource;
}

export default function SceneEntityRow(props: SceneEntityRowProps) {
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

  function activate() {
    if (!entity.value) return;
    props.source.callService("scene", "turn_on", {}, { entity_id: entity.value.entity_id });
  }

  function handleRowTap() {
    if (props.config.entity) showMoreInfo(props.config.entity);
  }

  return (
    <View class="flex-row items-center justify-between px-3 py-2">
      <Focusable
        class="flex-row items-center gap-2 flex-1 rounded-lg focus:bg-slate-700 active:bg-slate-600 py-1"
        onPress={handleRowTap}
      >
        <Text class="text-xs text-violet-400">{"\u2605"}</Text>
        <Text class="text-sm text-slate-200" style={{ maxLines: 1 }}>
          {name.value}
        </Text>
      </Focusable>
      <Focusable
        class="px-2 py-1 rounded-lg bg-blue-900 focus:bg-blue-800 active:bg-blue-700"
        onPress={activate}
      >
        <Text class="text-xs text-blue-300 font-bold">ACTIVATE</Text>
      </Focusable>
    </View>
  );
}
