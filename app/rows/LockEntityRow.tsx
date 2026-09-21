import { View, Text, Focusable } from "@pocketjs/framework/components";
import { computed } from "vue";
import type { EntityRowConfig } from "../types/row.ts";
import type { EntityState, HassEntity } from "../types/entity.ts";
import { entityName } from "../store/entity-store.ts";
import { useMoreInfo } from "../store/more-info-context.ts";
import type { DataSource } from "../store/data-source.ts";

export interface LockEntityRowProps {
  config: EntityRowConfig;
  entities: EntityState;
  source: DataSource;
}

export default function LockEntityRow(props: LockEntityRowProps) {
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
  const locked = computed(() => entity.value?.state === "locked");

  function toggle() {
    if (!entity.value) return;
    props.source.callService(
      "lock",
      locked.value ? "unlock" : "lock",
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
        <View
          class={
            locked.value
              ? "w-2 h-2 rounded-full bg-emerald-400"
              : "w-2 h-2 rounded-full bg-amber-400"
          }
        />
        <Text class="text-sm text-slate-200" style={{ maxLines: 1 }}>
          {name.value}
        </Text>
      </Focusable>
      <Focusable
        class={
          locked.value
            ? "px-2 py-1 rounded-lg bg-emerald-900 focus:bg-emerald-800 active:bg-emerald-700"
            : "px-2 py-1 rounded-lg bg-amber-900 focus:bg-amber-800 active:bg-amber-700"
        }
        onPress={toggle}
      >
        <Text
          class={
            locked.value ? "text-xs text-emerald-300 font-bold" : "text-xs text-amber-300 font-bold"
          }
        >
          {locked.value ? "Locked" : "Unlocked"}
        </Text>
      </Focusable>
    </View>
  );
}
