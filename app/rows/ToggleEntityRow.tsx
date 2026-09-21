import { View, Text, Focusable } from "@pocketjs/framework/components";
import { computed } from "vue";
import type { EntityRowConfig } from "../types/row.ts";
import type { EntityState, HassEntity } from "../types/entity.ts";
import { entityDomain, TOGGLE_DOMAINS } from "../types/entity.ts";
import { entityName, isEntityOn } from "../store/entity-store.ts";
import { useMoreInfo } from "../store/more-info-context.ts";
import type { DataSource } from "../store/data-source.ts";
import { Switch } from "../ui/index.ts";

export interface ToggleEntityRowProps {
  config: EntityRowConfig;
  entities: EntityState;
  source: DataSource;
}

export default function ToggleEntityRow(props: ToggleEntityRowProps) {
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
  const on = computed(() => isEntityOn(entity.value));

  function toggle() {
    if (!entity.value) return;
    const domain = entityDomain(entity.value.entity_id);
    const svcDomain = TOGGLE_DOMAINS.has(domain) ? domain : "homeassistant";
    props.source.callService(svcDomain, "toggle", {}, { entity_id: entity.value.entity_id });
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
            on.value ? "w-2 h-2 rounded-full bg-amber-400" : "w-2 h-2 rounded-full bg-slate-600"
          }
        />
        <Text class="text-sm text-slate-200" style={{ maxLines: 1 }}>
          {name.value}
        </Text>
      </Focusable>
      <Switch checked={on.value} onPress={toggle} />
    </View>
  );
}
