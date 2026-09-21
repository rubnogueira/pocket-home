/**
 * EntityBadge — matches Home Assistant entity badge rendering.
 *
 * Supports: color dot, icon, state display, show_state, state_content,
 * visibility conditions, and display_type.
 */

import { View, Text, Focusable } from "@pocketjs/framework/components";
import HaIcon from "../icons/HaIcon.tsx";
import { computed } from "vue";
import type { EntityBadgeConfig } from "../types/badge.ts";
import type { EntityState, HassEntity } from "../types/entity.ts";
import { entityDomain } from "../types/entity.ts";
import {
  entityName,
  entityStateDisplay,
  entityStateContentDisplay,
  isEntityOn,
} from "../store/entity-store.ts";
import { checkConditionsMet } from "../store/condition-engine.ts";
import { useMoreInfo } from "../store/more-info-context.ts";
import type { DataSource } from "../store/data-source.ts";

export interface EntityBadgeProps {
  config: EntityBadgeConfig;
  entities: EntityState;
  source: DataSource;
}

const COLOR_DOT: Record<string, string> = {
  red: "w-3 h-3 rounded-lg bg-red-500",
  blue: "w-3 h-3 rounded-lg bg-blue-500",
  indigo: "w-3 h-3 rounded-lg bg-indigo-500",
  green: "w-3 h-3 rounded-lg bg-emerald-500",
  amber: "w-3 h-3 rounded-lg bg-amber-500",
  yellow: "w-3 h-3 rounded-lg bg-yellow-500",
  orange: "w-3 h-3 rounded-lg bg-orange-500",
  purple: "w-3 h-3 rounded-lg bg-purple-500",
  brown: "w-3 h-3 rounded-lg bg-amber-800",
  "deep-orange": "w-3 h-3 rounded-lg bg-orange-600",
  "dark-grey": "w-3 h-3 rounded-lg bg-slate-600",
  teal: "w-3 h-3 rounded-lg bg-teal-500",
  cyan: "w-3 h-3 rounded-lg bg-cyan-500",
  pink: "w-3 h-3 rounded-lg bg-pink-500",
};

export default function EntityBadge(props: EntityBadgeProps) {
  const showMoreInfo = useMoreInfo();
  const entity = computed(() => props.entities[props.config.entity] as HassEntity | undefined);
  const domain = entityDomain(props.config.entity);
  const deviceClass = computed(() => entity.value?.attributes.device_class as string | undefined);
  const color = props.config.color as string | undefined;
  const on = computed(() => isEntityOn(entity.value));

  // Visibility conditions (badge-level).
  const visible = computed(() => {
    const vis = (props.config as any).visibility;
    if (!vis || !vis.length) return true;
    return checkConditionsMet(vis, props.entities);
  });

  // show_state defaults to true. If false, hide state text.
  const showState = props.config.show_state !== false;

  const entityIcon = computed(() => entity.value?.attributes.icon as string | undefined);

  const label = computed(() => {
    if (!entity.value) return "unavailable";

    // state_content overrides default display.
    const sc = (props.config as any).state_content;
    if (sc) return entityStateContentDisplay(entity.value, sc);

    // For switches/automations that are on, show entity name (like HA heading badges).
    if (
      (domain === "switch" || domain === "input_boolean" || domain === "automation") &&
      on.value
    ) {
      return entityName(entity.value).toLowerCase();
    }
    return entityStateDisplay(entity.value);
  });

  const dotClass = color ? (COLOR_DOT[color] ?? "w-3 h-3 rounded-full bg-slate-500") : "";

  function handleTap() {
    showMoreInfo(props.config.entity);
  }

  // Hidden by visibility conditions.
  if (!visible.value) return null;

  return (
    <Focusable
      class="flex-row items-center gap-1 px-3 py-1 rounded-xl bg-slate-800 border border-slate-600 focus:bg-slate-700 active:bg-slate-600"
      onPress={handleTap}
    >
      {dotClass ? <View class={dotClass} /> : null}
      <HaIcon icon={entityIcon.value} domain={domain} deviceClass={deviceClass.value} size={14} />
      {showState ? <Text class="text-xs text-slate-200 font-bold">{label.value}</Text> : null}
    </Focusable>
  );
}
