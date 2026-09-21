import { Text, Focusable } from "@pocketjs/framework/components";
import { computed } from "vue";
import type { EntityRowConfig } from "../types/row.ts";
import type { EntityState, HassEntity } from "../types/entity.ts";
import { entityName } from "../store/entity-store.ts";
import { executeAction, defaultTapAction } from "../store/action-dispatcher.ts";
import { useMoreInfo } from "../store/more-info-context.ts";
import type { DataSource } from "../store/data-source.ts";

export interface ButtonRowProps {
  config: EntityRowConfig;
  entities: EntityState;
  source: DataSource;
}

export default function ButtonRow(props: ButtonRowProps) {
  const showMoreInfo = useMoreInfo();
  const entity = computed(
    () =>
      (props.config.entity ? props.entities[props.config.entity] : undefined) as
        | HassEntity
        | undefined,
  );
  const name = computed(
    () => props.config.name ?? entityName(entity.value, props.config.entity ?? "Button"),
  );

  function handlePress() {
    const action = props.config.tap_action ?? defaultTapAction(entity.value);
    executeAction(action, { entity: entity.value, source: props.source, showMoreInfo });
  }

  return (
    <Focusable
      class="flex-row items-center justify-between px-3 py-2 focus:bg-slate-700 active:bg-slate-600"
      onPress={handlePress}
    >
      <Text class="text-sm text-slate-200" style={{ maxLines: 1 }}>
        {name.value}
      </Text>
      <Text class="text-xs text-blue-400 font-bold">RUN</Text>
    </Focusable>
  );
}
