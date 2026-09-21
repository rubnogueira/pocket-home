import { View, Text, Focusable } from "@pocketjs/framework/components";
import type { HassEntity } from "../types/entity.ts";
import { entityDomain } from "../types/entity.ts";
import type { DataSource } from "../store/data-source.ts";

export interface SelectOptionsFeatureProps {
  config: { type: "select-options" };
  entity: HassEntity | undefined;
  source: DataSource;
}

export default function SelectOptionsFeature(props: SelectOptionsFeatureProps) {
  const options = (props.entity?.attributes.options as string[]) ?? [];
  const current = props.entity?.state ?? "";
  const domain = props.entity ? entityDomain(props.entity.entity_id) : "input_select";

  function select(option: string) {
    if (!props.entity) return;
    props.source.callService(
      domain,
      "select_option",
      { option },
      { entity_id: props.entity.entity_id },
    );
  }

  return (
    <View class="flex-row gap-1 flex-wrap">
      {options.map((opt) => (
        <Focusable
          key={opt}
          class={
            opt === current
              ? "px-2 py-1 rounded-lg bg-blue-900 focus:bg-blue-800 active:bg-blue-700"
              : "px-2 py-1 rounded-lg bg-slate-700 focus:bg-slate-600 active:bg-slate-500"
          }
          onPress={() => select(opt)}
        >
          <Text
            class={opt === current ? "text-xs text-blue-300 font-bold" : "text-xs text-slate-400"}
          >
            {opt}
          </Text>
        </Focusable>
      ))}
    </View>
  );
}
