import { Text, Focusable } from "@pocketjs/framework/components";
import { computed } from "vue";
import type { StatisticCardConfig } from "../types/card.ts";
import type { EntityState, HassEntity } from "../types/entity.ts";
import { entityName, entityStateDisplay } from "../store/entity-store.ts";
import { useMoreInfo } from "../store/more-info-context.ts";
import type { DataSource } from "../store/data-source.ts";
import { HA_CARD_PRESS_GAP1 } from "../ui/tokens.ts";

export interface StatisticCardProps {
  config: StatisticCardConfig;
  entities: EntityState;
  source: DataSource;
}

export default function StatisticCard(props: StatisticCardProps) {
  const showMoreInfo = useMoreInfo();
  const entity = computed(() => props.entities[props.config.entity] as HassEntity | undefined);
  const name = computed(() => props.config.name ?? entityName(entity.value, props.config.entity));
  const statType = props.config.stat_type ?? "mean";
  const state = computed(() => entityStateDisplay(entity.value));

  return (
    <Focusable class={HA_CARD_PRESS_GAP1} onPress={() => showMoreInfo(props.config.entity)}>
      <Text class="text-xs text-slate-500 font-bold">{statType.toUpperCase()}</Text>
      <Text class="text-sm text-slate-100 font-bold">{name.value}</Text>
      <Text class="text-2xl text-slate-50 font-bold">{state.value}</Text>
    </Focusable>
  );
}
