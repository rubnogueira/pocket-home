import { View, Text, Focusable } from "@pocketjs/framework/components";
import { computed } from "vue";
import type { HassEntity } from "../types/entity.ts";
import type { DataSource } from "../store/data-source.ts";

export interface TargetTempFeatureProps {
  config: { type: "target-temperature" };
  entity: HassEntity | undefined;
  source: DataSource;
}

export default function TargetTempFeature(props: TargetTempFeatureProps) {
  const target = computed(() => (props.entity?.attributes.temperature as number) ?? 20);
  const step = computed(() => (props.entity?.attributes.target_temp_step as number) ?? 0.5);

  function adjust(delta: number) {
    if (!props.entity) return;
    const next = target.value + delta;
    const min = (props.entity.attributes.min_temp as number) ?? 5;
    const max = (props.entity.attributes.max_temp as number) ?? 35;
    const clamped = Math.max(min, Math.min(max, next));
    props.source.callService(
      "climate",
      "set_temperature",
      { temperature: clamped },
      { entity_id: props.entity.entity_id },
    );
  }

  return (
    <View class="flex-row items-center justify-between">
      <Focusable
        class="w-8 h-8 rounded-lg bg-slate-700 items-center justify-center focus:bg-slate-600 active:bg-slate-500"
        onPress={() => adjust(-step.value)}
      >
        <Text class="text-sm text-slate-300 font-bold">{"\u2212"}</Text>
      </Focusable>
      <Text class="text-sm text-slate-100 font-bold">
        {target.value}
        {"\u00b0"}
      </Text>
      <Focusable
        class="w-8 h-8 rounded-lg bg-slate-700 items-center justify-center focus:bg-slate-600 active:bg-slate-500"
        onPress={() => adjust(step.value)}
      >
        <Text class="text-sm text-slate-300 font-bold">+</Text>
      </Focusable>
    </View>
  );
}
