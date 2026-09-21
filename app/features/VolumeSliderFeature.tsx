import { View, Text, Focusable } from "@pocketjs/framework/components";
import type { HassEntity } from "../types/entity.ts";
import type { DataSource } from "../store/data-source.ts";
import { Progress } from "../ui/index.ts";

export interface VolumeSliderFeatureProps {
  config: { type: "media-player-volume-slider" };
  entity: HassEntity | undefined;
  source: DataSource;
}

export default function VolumeSliderFeature(props: VolumeSliderFeatureProps) {
  const vol = (props.entity?.attributes.volume_level as number) ?? 0;
  const pct = Math.round(vol * 100);

  function adjust(delta: number) {
    if (!props.entity) return;
    const next = Math.max(0, Math.min(1, vol + delta));
    props.source.callService(
      "media_player",
      "volume_set",
      { volume_level: next },
      { entity_id: props.entity.entity_id },
    );
  }

  return (
    <View class="flex-row items-center gap-2">
      <Focusable
        class="w-6 h-6 rounded-lg bg-slate-700 items-center justify-center focus:bg-slate-600 active:bg-slate-500"
        onPress={() => adjust(-0.05)}
      >
        <Text class="text-xs text-slate-300 font-bold">-</Text>
      </Focusable>
      <View class="flex-1">
        <Progress value={pct} max={100} />
      </View>
      <Focusable
        class="w-6 h-6 rounded-lg bg-slate-700 items-center justify-center focus:bg-slate-600 active:bg-slate-500"
        onPress={() => adjust(0.05)}
      >
        <Text class="text-xs text-slate-300 font-bold">+</Text>
      </Focusable>
      <Text class="text-xs text-slate-400" style={{ width: 28 }}>
        {pct}%
      </Text>
    </View>
  );
}
