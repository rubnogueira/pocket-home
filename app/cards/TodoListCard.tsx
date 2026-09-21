import { View, Text, Focusable } from "@pocketjs/framework/components";
import { computed } from "vue";
import type { TodoListCardConfig } from "../types/card.ts";
import type { EntityState, HassEntity } from "../types/entity.ts";
import { entityName } from "../store/entity-store.ts";
import { useMoreInfo } from "../store/more-info-context.ts";
import type { DataSource } from "../store/data-source.ts";
import { HA_CARD_PRESS_GAP2 } from "../ui/tokens.ts";

export interface TodoListCardProps {
  config: TodoListCardConfig;
  entities: EntityState;
  source: DataSource;
}

export default function TodoListCard(props: TodoListCardProps) {
  const showMoreInfo = useMoreInfo();
  const entity = computed(() => props.entities[props.config.entity] as HassEntity | undefined);
  const name = computed(() => props.config.title ?? entityName(entity.value, "To-do"));
  const itemCount = computed(() => entity.value?.state ?? "0");

  function handleTap() {
    showMoreInfo(props.config.entity);
  }

  return (
    <Focusable class={HA_CARD_PRESS_GAP2} onPress={handleTap}>
      <Text class="text-sm text-slate-100 font-bold">{name.value}</Text>
      <Text class="text-xs text-slate-400">{itemCount.value} items</Text>
      <View class="flex-1 items-center justify-center">
        <Text class="text-xs text-slate-600">To-do list</Text>
      </View>
    </Focusable>
  );
}
