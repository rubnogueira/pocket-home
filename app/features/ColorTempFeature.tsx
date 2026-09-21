import { View, Text, Focusable } from "@pocketjs/framework/components";
import type { HassEntity } from "../types/entity.ts";
import type { DataSource } from "../store/data-source.ts";
import { Progress } from "../ui/index.ts";

export interface ColorTempFeatureProps {
  config: { type: "light-color-temp" };
  entity: HassEntity | undefined;
  source: DataSource;
}

export default function ColorTempFeature(props: ColorTempFeatureProps) {
  const ct = (props.entity?.attributes.color_temp as number) ?? 300;
  const minM = (props.entity?.attributes.min_mireds as number) ?? 153;
  const maxM = (props.entity?.attributes.max_mireds as number) ?? 500;
  const pct = Math.round(((ct - minM) / (maxM - minM)) * 100);

  function adjust(delta: number) {
    if (!props.entity) return;
    const next = Math.max(minM, Math.min(maxM, ct + delta));
    props.source.callService(
      "light",
      "turn_on",
      { color_temp: next },
      { entity_id: props.entity.entity_id },
    );
  }

  return (
    <View class="flex-row items-center gap-2">
      <Focusable
        class="w-6 h-6 rounded-lg bg-slate-700 items-center justify-center focus:bg-slate-600 active:bg-slate-500"
        onPress={() => adjust(-20)}
      >
        <Text class="text-xs text-amber-300 font-bold">{"\u2600"}</Text>
      </Focusable>
      <View class="flex-1">
        <Progress value={pct} max={100} />
      </View>
      <Focusable
        class="w-6 h-6 rounded-lg bg-slate-700 items-center justify-center focus:bg-slate-600 active:bg-slate-500"
        onPress={() => adjust(20)}
      >
        <Text class="text-xs text-blue-300 font-bold">{"\u2744"}</Text>
      </Focusable>
    </View>
  );
}
