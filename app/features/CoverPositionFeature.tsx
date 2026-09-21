import { View, Text, Focusable } from "@pocketjs/framework/components";
import type { HassEntity } from "../types/entity.ts";
import type { DataSource } from "../store/data-source.ts";
import { Progress } from "../ui/index.ts";

export interface CoverPositionFeatureProps {
  config: { type: "cover-position" };
  entity: HassEntity | undefined;
  source: DataSource;
}

export default function CoverPositionFeature(props: CoverPositionFeatureProps) {
  const pos = (props.entity?.attributes.current_position as number) ?? 0;

  function adjust(delta: number) {
    if (!props.entity) return;
    const next = Math.max(0, Math.min(100, pos + delta));
    props.source.callService(
      "cover",
      "set_cover_position",
      { position: next },
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
        <Progress value={pos} max={100} />
      </View>
      <Focusable
        class="w-6 h-6 rounded-lg bg-slate-700 items-center justify-center focus:bg-slate-600 active:bg-slate-500"
        onPress={() => adjust(10)}
      >
        <Text class="text-xs text-slate-300 font-bold">+</Text>
      </Focusable>
      <Text class="text-xs text-slate-400" style={{ width: 28 }}>
        {pos}%
      </Text>
    </View>
  );
}
