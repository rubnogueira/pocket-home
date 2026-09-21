import { Text, Focusable } from "@pocketjs/framework/components";
import type { ShortcutBadgeConfig } from "../types/badge.ts";
import type { EntityState } from "../types/entity.ts";
import { executeAction } from "../store/action-dispatcher.ts";
import { useMoreInfo } from "../store/more-info-context.ts";
import type { DataSource } from "../store/data-source.ts";
import HaIcon from "../icons/HaIcon.tsx";

export interface ShortcutBadgeProps {
  config: ShortcutBadgeConfig;
  entities: EntityState;
  source: DataSource;
}

export default function ShortcutBadge(props: ShortcutBadgeProps) {
  const showMoreInfo = useMoreInfo();

  function handleTap() {
    if (props.config.tap_action) {
      executeAction(props.config.tap_action, { source: props.source, showMoreInfo });
    }
  }

  return (
    <Focusable
      class="flex-row items-center gap-1 px-2 py-1 rounded-xl bg-slate-700 focus:bg-slate-600 active:bg-slate-500"
      onPress={handleTap}
    >
      {props.config.icon ? <HaIcon icon={props.config.icon} size={14} /> : null}
      <Text class="text-xs text-slate-300">{props.config.name ?? "Shortcut"}</Text>
    </Focusable>
  );
}
