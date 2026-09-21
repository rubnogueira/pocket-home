import { Text, Focusable } from "@pocketjs/framework/components";
import type { ShortcutCardConfig } from "../types/card.ts";
import type { EntityState } from "../types/entity.ts";
import { executeAction } from "../store/action-dispatcher.ts";
import { useMoreInfo } from "../store/more-info-context.ts";
import type { DataSource } from "../store/data-source.ts";
import { HA_CARD_PRESS_CENTER_GAP1 } from "../ui/tokens.ts";
import HaIcon from "../icons/HaIcon.tsx";

export interface ShortcutCardProps {
  config: ShortcutCardConfig;
  entities: EntityState;
  source: DataSource;
}

export default function ShortcutCard(props: ShortcutCardProps) {
  const showMoreInfo = useMoreInfo();

  function handleTap() {
    if (props.config.tap_action) {
      executeAction(props.config.tap_action, { source: props.source, showMoreInfo });
    }
  }

  return (
    <Focusable class={HA_CARD_PRESS_CENTER_GAP1} onPress={handleTap}>
      {props.config.icon ? <HaIcon icon={props.config.icon} size={22} /> : null}
      <Text class="text-sm text-slate-200 font-bold">{props.config.name ?? "Shortcut"}</Text>
    </Focusable>
  );
}
