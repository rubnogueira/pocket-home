import { View, Text, Focusable } from "@pocketjs/framework/components";
import { computed } from "vue";
import type { EntityRowConfig } from "../types/row.ts";
import type { EntityState, HassEntity } from "../types/entity.ts";
import { entityName } from "../store/entity-store.ts";
import { useMoreInfo } from "../store/more-info-context.ts";
import type { DataSource } from "../store/data-source.ts";

export interface CoverEntityRowProps {
  config: EntityRowConfig;
  entities: EntityState;
  source: DataSource;
}

export default function CoverEntityRow(props: CoverEntityRowProps) {
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
  const pos = computed(() => entity.value?.attributes.current_position as number | undefined);
  const isOpen = computed(() => entity.value?.state === "open");

  function toggle() {
    if (!entity.value) return;
    props.source.callService(
      "cover",
      isOpen.value ? "close_cover" : "open_cover",
      {},
      { entity_id: entity.value.entity_id },
    );
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
        <Text class="text-sm text-slate-200" style={{ maxLines: 1 }}>
          {name.value}
        </Text>
        {pos.value != null ? <Text class="text-xs text-slate-400">{pos.value}%</Text> : null}
      </Focusable>
      <Focusable
        class="px-2 py-1 rounded-lg bg-slate-700 focus:bg-slate-600 active:bg-slate-500"
        onPress={toggle}
      >
        <Text class="text-xs text-slate-300 font-bold">{isOpen.value ? "\u25BC" : "\u25B2"}</Text>
      </Focusable>
    </View>
  );
}
