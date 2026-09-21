import { View, Text, Focusable } from "@pocketjs/framework/components";
import { computed } from "vue";
import type { AlarmPanelCardConfig } from "../types/card.ts";
import type { EntityState, HassEntity } from "../types/entity.ts";
import { entityName } from "../store/entity-store.ts";
import { useMoreInfo } from "../store/more-info-context.ts";
import type { DataSource } from "../store/data-source.ts";
import { HA_CARD_PRESS_GAP3 } from "../ui/tokens.ts";
import { Badge } from "../ui/index.ts";

export interface AlarmPanelCardProps {
  config: AlarmPanelCardConfig;
  entities: EntityState;
  source: DataSource;
}

const STATE_COLORS: Record<string, "success" | "warning" | "danger" | "default"> = {
  armed_home: "success",
  armed_away: "success",
  armed_night: "success",
  disarmed: "warning",
  pending: "warning",
  triggered: "danger",
};

export default function AlarmPanelCard(props: AlarmPanelCardProps) {
  const showMoreInfo = useMoreInfo();
  const entity = computed(() => props.entities[props.config.entity] as HassEntity | undefined);
  const name = computed(() => props.config.name ?? entityName(entity.value, "Alarm"));
  const state = computed(() => entity.value?.state ?? "disarmed");
  const states = props.config.states ?? ["armed_home", "armed_away"];

  function arm(mode: string) {
    if (!entity.value) return;
    const svcMap: Record<string, string> = {
      armed_home: "alarm_arm_home",
      armed_away: "alarm_arm_away",
      armed_night: "alarm_arm_night",
      armed_vacation: "alarm_arm_vacation",
    };
    props.source.callService(
      "alarm_control_panel",
      svcMap[mode] ?? "alarm_arm_home",
      {},
      { entity_id: entity.value.entity_id },
    );
  }

  function disarm() {
    if (!entity.value) return;
    props.source.callService(
      "alarm_control_panel",
      "alarm_disarm",
      {},
      { entity_id: entity.value.entity_id },
    );
  }

  function handleTap() {
    if (entity.value) showMoreInfo(entity.value.entity_id);
  }

  return (
    <Focusable class={HA_CARD_PRESS_GAP3} onPress={handleTap}>
      <View class="flex-row items-center justify-between">
        <Text class="text-sm text-slate-100 font-bold">{name.value}</Text>
        <Badge
          label={state.value.replace(/_/g, " ")}
          variant={STATE_COLORS[state.value] ?? "default"}
        />
      </View>
      <View class="flex-row gap-2 flex-wrap">
        {states.map((s) => (
          <Focusable
            key={s}
            class={
              s === state.value
                ? "px-3 py-2 rounded-xl bg-blue-900 focus:bg-blue-800 active:bg-blue-700"
                : "px-3 py-2 rounded-xl bg-slate-700 focus:bg-slate-600 active:bg-slate-500"
            }
            onPress={() => arm(s)}
          >
            <Text
              class={
                s === state.value ? "text-xs text-blue-300 font-bold" : "text-xs text-slate-300"
              }
            >
              {s.replace(/_/g, " ")}
            </Text>
          </Focusable>
        ))}
        <Focusable
          class={
            state.value === "disarmed"
              ? "px-3 py-2 rounded-xl bg-amber-900 focus:bg-amber-800 active:bg-amber-700"
              : "px-3 py-2 rounded-xl bg-slate-700 focus:bg-slate-600 active:bg-slate-500"
          }
          onPress={disarm}
        >
          <Text class="text-xs text-slate-300 font-bold">Disarm</Text>
        </Focusable>
      </View>
    </Focusable>
  );
}
