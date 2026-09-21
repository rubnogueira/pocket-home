import { View, Text, Focusable } from "@pocketjs/framework/components";
import { computed } from "vue";
import type { HassEntity } from "../types/entity.ts";
import type { DataSource } from "../store/data-source.ts";
import { Progress } from "../ui/index.ts";

export interface BrightnessFeatureProps {
  config: { type: "light-brightness" };
  entity: HassEntity | undefined;
  source: DataSource;
}

export default function BrightnessFeature(props: BrightnessFeatureProps) {
  const brightness = computed(() => (props.entity?.attributes.brightness as number) ?? 0);
  const pct = computed(() => Math.round((brightness.value / 255) * 100));

  function adjust(delta: number) {
    if (!props.entity) return;
    const next = Math.max(0, Math.min(255, brightness.value + Math.round(delta * 2.55)));
    props.source.callService(
      "light",
      "turn_on",
      { brightness: next },
      { entity_id: props.entity.entity_id },
    );
  }

  return (
    <View class="flex-row items-center gap-2">
      <Focusable
        class="w-6 h-6 rounded-lg bg-slate-700 items-center justify-center focus:bg-slate-600 active:bg-slate-500"
        onPress={() => adjust(-10)}
      >
        <Text class="text-xs text-slate-300 font-bold">-</Text>
      </Focusable>
      <View class="flex-1">
        <Progress value={pct.value} max={100} />
      </View>
      <Focusable
        class="w-6 h-6 rounded-lg bg-slate-700 items-center justify-center focus:bg-slate-600 active:bg-slate-500"
        onPress={() => adjust(10)}
      >
        <Text class="text-xs text-slate-300 font-bold">+</Text>
      </Focusable>
      <Text class="text-xs text-slate-400" style={{ width: 28 }}>
        {pct.value}%
      </Text>
    </View>
  );
}
