import { View, Text, Focusable } from "@pocketjs/framework/components";
import { computed } from "vue";
import type { HistoryGraphCardConfig } from "../types/card.ts";
import type { EntityState, HassEntity } from "../types/entity.ts";
import { entityName, entityStateDisplay } from "../store/entity-store.ts";
import { useMoreInfo } from "../store/more-info-context.ts";
import type { DataSource } from "../store/data-source.ts";
import { HA_CARD_PRESS_GAP2 } from "../ui/tokens.ts";

export interface HistoryGraphCardProps {
  config: HistoryGraphCardConfig;
  entities: EntityState;
  source: DataSource;
}

export default function HistoryGraphCard(props: HistoryGraphCardProps) {
  const showMoreInfo = useMoreInfo();
  const title = props.config.title;
  const items = props.config.entities ?? [];

  const entityRefs = items.map((item) => {
    const eid = typeof item === "string" ? item : item.entity;
    return computed(() => props.entities[eid] as HassEntity | undefined);
  });

  function handleCardTap() {
    if (items.length > 0) {
      const eid = typeof items[0] === "string" ? items[0] : items[0].entity;
      showMoreInfo(eid);
    }
  }

  return (
    <Focusable class={HA_CARD_PRESS_GAP2} onPress={handleCardTap}>
      {title ? <Text class="text-sm text-slate-100 font-bold">{title}</Text> : null}
      <View class="flex-col gap-1">
        {items.map((item, i) => {
          const eid = typeof item === "string" ? item : item.entity;
          const entityRef = entityRefs[i];
          const itemName = computed(() => {
            const n = typeof item === "string" ? undefined : item.name;
            return n ?? entityName(entityRef.value, eid);
          });
          const state = computed(() => entityStateDisplay(entityRef.value));
          return (
            <Focusable
              key={`hg-${i}`}
              class="flex-row items-center justify-between px-1 py-1 rounded-lg focus:bg-slate-600 active:bg-slate-500"
              onPress={() => showMoreInfo(eid)}
            >
              <Text class="text-xs text-slate-300">{itemName.value}</Text>
              <Text class="text-xs text-slate-400">{state.value}</Text>
            </Focusable>
          );
        })}
      </View>
      <View class="flex-row items-center justify-center py-2">
        <Text class="text-xs text-slate-600">
          History graph (last {props.config.hours_to_show ?? 24}h)
        </Text>
      </View>
    </Focusable>
  );
}
