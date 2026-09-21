import { View, Text, Focusable } from "@pocketjs/framework/components";
import { computed } from "vue";
import type { ButtonCardConfig } from "../types/card.ts";
import type { EntityState, HassEntity } from "../types/entity.ts";
import { entityDomain } from "../types/entity.ts";
import { entityName, entityStateDisplay, isEntityOn } from "../store/entity-store.ts";
import { executeAction, defaultTapAction } from "../store/action-dispatcher.ts";
import { useMoreInfo } from "../store/more-info-context.ts";
import type { DataSource } from "../store/data-source.ts";
import { HA_CARD_PRESS_CENTER_GAP2 } from "../ui/tokens.ts";
import HaIcon from "../icons/HaIcon.tsx";

export interface ButtonCardProps {
  config: ButtonCardConfig;
  entities: EntityState;
  source: DataSource;
}

export default function ButtonCard(props: ButtonCardProps) {
  const showMoreInfo = useMoreInfo();
  const entity = computed(
    () =>
      (props.config.entity ? props.entities[props.config.entity] : undefined) as
        | HassEntity
        | undefined,
  );
  const name = computed(() => props.config.name ?? entityName(entity.value, "Button"));
  const on = computed(() => isEntityOn(entity.value));
  const showName = props.config.show_name !== false;
  const showState = props.config.show_state ?? false;
  const stateStr = computed(() => entityStateDisplay(entity.value));

  function handleTap() {
    const action = props.config.tap_action ?? defaultTapAction(entity.value);
    executeAction(action, { entity: entity.value, source: props.source, showMoreInfo });
  }

  return (
    <Focusable class={HA_CARD_PRESS_CENTER_GAP2} onPress={handleTap}>
      <View
        class={
          on.value
            ? "w-12 h-12 rounded-full bg-amber-900 items-center justify-center"
            : "w-12 h-12 rounded-full bg-slate-700 items-center justify-center"
        }
      >
        <HaIcon
          icon={props.config.icon ?? "mdi:gesture-tap-button"}
          domain={props.config.entity ? entityDomain(props.config.entity) : undefined}
          size={24}
        />
      </View>
      {showName ? (
        <Text class="text-sm text-slate-200 font-bold text-center" style={{ maxLines: 1 }}>
          {name.value}
        </Text>
      ) : null}
      {showState ? <Text class="text-xs text-slate-400 text-center">{stateStr.value}</Text> : null}
    </Focusable>
  );
}
