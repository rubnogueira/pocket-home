import { View, Text, Focusable } from "@pocketjs/framework/components";
import { computed } from "vue";
import type { LightCardConfig } from "../types/card.ts";
import type { EntityState, HassEntity } from "../types/entity.ts";
import { entityName, isEntityOn } from "../store/entity-store.ts";
import { useMoreInfo } from "../store/more-info-context.ts";
import type { DataSource } from "../store/data-source.ts";
import { HA_CARD_PRESS_GAP3 } from "../ui/tokens.ts";
import { Progress } from "../ui/index.ts";

export interface LightCardProps {
  config: LightCardConfig;
  entities: EntityState;
  source: DataSource;
}

export default function LightCard(props: LightCardProps) {
  const showMoreInfo = useMoreInfo();
  const entity = computed(() => props.entities[props.config.entity] as HassEntity | undefined);
  const name = computed(() => props.config.name ?? entityName(entity.value, props.config.entity));
  const on = computed(() => isEntityOn(entity.value));
  const brightness = computed(
    () => (entity.value?.attributes.brightness as number | undefined) ?? 0,
  );
  const pct = computed(() => Math.round((brightness.value / 255) * 100));

  function handleTap() {
    showMoreInfo(props.config.entity);
  }

  return (
    <Focusable class={HA_CARD_PRESS_GAP3} onPress={handleTap}>
      <View class="flex-row items-center justify-between">
        <Text class="text-sm text-slate-100 font-bold">{name.value}</Text>
        <View
          class={
            on.value
              ? "w-8 h-8 rounded-full bg-amber-900 items-center justify-center"
              : "w-8 h-8 rounded-full bg-slate-700 items-center justify-center"
          }
        >
          <Text
            class={
              on.value ? "text-xs text-amber-300 font-bold" : "text-xs text-slate-500 font-bold"
            }
          >
            {on.value ? "\u2600" : "\u25CB"}
          </Text>
        </View>
      </View>

      {on.value ? (
        <View class="flex-col gap-1">
          <View class="flex-row items-center justify-between">
            <Text class="text-xs text-slate-400">Brightness</Text>
            <Text class="text-xs text-slate-300 font-bold">{pct.value}%</Text>
          </View>
          <Progress value={pct.value} max={100} />
        </View>
      ) : (
        <Text class="text-xs text-slate-500">Off</Text>
      )}
    </Focusable>
  );
}
