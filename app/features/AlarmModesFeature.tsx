import { View, Text, Focusable } from "@pocketjs/framework/components";
import type { AlarmModesFeatureConfig } from "../types/feature.ts";
import type { HassEntity } from "../types/entity.ts";
import type { DataSource } from "../store/data-source.ts";

export interface AlarmModesFeatureProps {
  config: AlarmModesFeatureConfig;
  entity: HassEntity | undefined;
  source: DataSource;
}

const MODE_SERVICE: Record<string, string> = {
  armed_home: "alarm_arm_home",
  armed_away: "alarm_arm_away",
  armed_night: "alarm_arm_night",
  armed_vacation: "alarm_arm_vacation",
  disarmed: "alarm_disarm",
};

export default function AlarmModesFeature(props: AlarmModesFeatureProps) {
  const modes = props.config.modes ?? ["armed_home", "armed_away", "disarmed"];
  const current = props.entity?.state ?? "disarmed";

  function setMode(mode: string) {
    if (!props.entity) return;
    const svc = MODE_SERVICE[mode] ?? "alarm_disarm";
    props.source.callService("alarm_control_panel", svc, {}, { entity_id: props.entity.entity_id });
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
            {mode.replace(/_/g, " ")}
          </Text>
        </Focusable>
      ))}
    </View>
  );
}
