import { View, Text, Focusable } from "@pocketjs/framework/components";
import { computed } from "vue";
import type { EntityCardConfig } from "../types/card.ts";
import type { EntityState, HassEntity } from "../types/entity.ts";
import { entityName, entityStateDisplay, isEntityOn } from "../store/entity-store.ts";
import { useMoreInfo } from "../store/more-info-context.ts";
import type { DataSource } from "../store/data-source.ts";
import { HA_CARD_PRESS_GAP2 } from "../ui/tokens.ts";
import { Badge } from "../ui/index.ts";

export interface EntityCardProps {
  config: EntityCardConfig;
  entities: EntityState;
  source: DataSource;
}

export default function EntityCard(props: EntityCardProps) {
  const showMoreInfo = useMoreInfo();
  const entity = computed(() => props.entities[props.config.entity] as HassEntity | undefined);
  const name = computed(() => props.config.name ?? entityName(entity.value, props.config.entity));
  const on = computed(() => isEntityOn(entity.value));

  const stateStr = computed(() => {
    if (props.config.attribute && entity.value) {
      const val = entity.value.attributes[props.config.attribute];
      return val != null ? `${val}${props.config.unit ? ` ${props.config.unit}` : ""}` : "—";
    }
    return entityStateDisplay(entity.value);
  });

  function handleTap() {
    showMoreInfo(props.config.entity);
  }

  return (
    <Focusable class={HA_CARD_PRESS_GAP2} onPress={handleTap}>
      <Text class="text-sm text-slate-100 font-bold" style={{ maxLines: 1 }}>
        {name.value}
      </Text>
      <View class="flex-row items-center justify-between">
        <Text class="text-2xl text-slate-50 font-bold">{stateStr.value}</Text>
        <Badge label={on.value ? "on" : "off"} variant={on.value ? "success" : "default"} />
      </View>
    </Focusable>
  );
}
