import { View, Text, Focusable } from "@pocketjs/framework/components";
import type { ClimateHvacModesFeatureConfig } from "../types/feature.ts";
import type { HassEntity } from "../types/entity.ts";
import type { DataSource } from "../store/data-source.ts";

export interface HvacModesFeatureProps {
  config: ClimateHvacModesFeatureConfig;
  entity: HassEntity | undefined;
  source: DataSource;
}

export default function HvacModesFeature(props: HvacModesFeatureProps) {
  const modes = props.config.hvac_modes ??
    (props.entity?.attributes.hvac_modes as string[] | undefined) ?? [
      "off",
      "heat",
      "cool",
      "auto",
    ];
  const current = props.entity?.state ?? "off";

  function setMode(mode: string) {
    if (!props.entity) return;
    props.source.callService(
      "climate",
      "set_hvac_mode",
      { hvac_mode: mode },
      { entity_id: props.entity.entity_id },
    );
  }

  return (
    <View class="flex-row gap-1 flex-wrap">
      {modes.map((mode) => (
        <Focusable
          key={mode}
          class={
            mode === current
              ? "px-2 py-1 rounded-lg bg-blue-900 focus:bg-blue-800 active:bg-blue-700"
              : "px-2 py-1 rounded-lg bg-slate-700 focus:bg-slate-600 active:bg-slate-500"
          }
          onPress={() => setMode(mode)}
        >
          <Text
            class={mode === current ? "text-xs text-blue-300 font-bold" : "text-xs text-slate-400"}
          >
            {mode}
          </Text>
        </Focusable>
      ))}
    </View>
  );
}
