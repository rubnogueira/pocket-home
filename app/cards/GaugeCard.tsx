import { View, Text, Focusable } from "@pocketjs/framework/components";
import { computed } from "vue";
import type { GaugeCardConfig } from "../types/card.ts";
import type { EntityState, HassEntity } from "../types/entity.ts";
import { entityName } from "../store/entity-store.ts";
import { useMoreInfo } from "../store/more-info-context.ts";
import type { DataSource } from "../store/data-source.ts";
import { HA_CARD_PRESS_GAP2 } from "../ui/tokens.ts";
import { Progress, Badge } from "../ui/index.ts";

export interface GaugeCardProps {
  config: GaugeCardConfig;
  entities: EntityState;
  source: DataSource;
}

export default function GaugeCard(props: GaugeCardProps) {
  const showMoreInfo = useMoreInfo();
  const entity = computed(() => props.entities[props.config.entity] as HassEntity | undefined);
  const name = computed(() => props.config.name ?? entityName(entity.value, props.config.entity));
  const min = props.config.min ?? 0;
  const max = props.config.max ?? 100;
  const unit = computed(
    () =>
      props.config.unit ??
      (entity.value?.attributes.unit_of_measurement as string | undefined) ??
      "",
  );
  const val = computed(() => Number(entity.value?.state ?? 0));
  const pct = computed(() => Math.max(0, Math.min(100, ((val.value - min) / (max - min)) * 100)));

  const color = computed((): "success" | "warning" | "danger" | "default" => {
    if (props.config.severity) {
      const s = props.config.severity;
      if (s.red != null && val.value >= s.red) return "danger";
      if (s.yellow != null && val.value >= s.yellow) return "warning";
      if (s.green != null && val.value >= s.green) return "success";
    }
    return "default";
  });

  function handleTap() {
    showMoreInfo(props.config.entity);
  }

  return (
    <Focusable class={HA_CARD_PRESS_GAP2} onPress={handleTap}>
      <View class="flex-row items-center justify-between">
        <Text class="text-sm text-slate-100 font-bold">{name.value}</Text>
        <Badge label={`${val.value}${unit.value ? ` ${unit.value}` : ""}`} variant={color.value} />
      </View>
      <Progress value={pct.value} max={100} />
      <View class="flex-row items-center justify-between">
        <Text class="text-xs text-slate-500">{min}</Text>
        <Text class="text-xs text-slate-500">{max}</Text>
      </View>
    </Focusable>
  );
}
