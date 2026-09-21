import { View, Text, Focusable } from "@pocketjs/framework/components";
import type { HassEntity } from "../types/entity.ts";
import { entityDomain } from "../types/entity.ts";
import type { DataSource } from "../store/data-source.ts";

export interface NumericInputFeatureProps {
  config: { type: "numeric-input"; style?: "slider" | "buttons" };
  entity: HassEntity | undefined;
  source: DataSource;
}

export default function NumericInputFeature(props: NumericInputFeatureProps) {
  const val = Number(props.entity?.state ?? 0);
  const min = Number(props.entity?.attributes.min ?? 0);
  const max = Number(props.entity?.attributes.max ?? 100);
  const step = Number(props.entity?.attributes.step ?? 1);
  const unit = (props.entity?.attributes.unit_of_measurement as string) ?? "";
  const domain = props.entity ? entityDomain(props.entity.entity_id) : "input_number";

  function adjust(delta: number) {
    if (!props.entity) return;
    const next = Math.max(min, Math.min(max, val + delta));
    props.source.callService(
      domain,
      "set_value",
      { value: next },
      { entity_id: props.entity.entity_id },
    );
  }

  return (
    <View class="flex-row items-center justify-between">
      <Focusable
        class="w-8 h-8 rounded-lg bg-slate-700 items-center justify-center focus:bg-slate-600 active:bg-slate-500"
        onPress={() => adjust(-step)}
      >
        <Text class="text-sm text-slate-300 font-bold">-</Text>
      </Focusable>
      <Text class="text-sm text-slate-100 font-bold">
        {val}
        {unit ? ` ${unit}` : ""}
      </Text>
      <Focusable
        class="w-8 h-8 rounded-lg bg-slate-700 items-center justify-center focus:bg-slate-600 active:bg-slate-500"
        onPress={() => adjust(step)}
      >
        <Text class="text-sm text-slate-300 font-bold">+</Text>
      </Focusable>
    </View>
  );
}
