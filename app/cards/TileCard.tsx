/**
 * TileCard — matches Home Assistant's tile card rendering.
 *
 * Layout:  [icon-circle]  [name + state]
 *          [features …]
 *
 * - Icon circle: tappable, toggles the entity for toggle domains.
 *   Colored when entity is active, grey when off.
 * - Name/state area: tapping opens more-info dialog.
 * - NO Switch widget — HA tile cards do not render a toggle switch.
 * - Supports `color` config for icon active state.
 * - Supports `state_content` for custom state display.
 */

import { View, Text, Focusable } from "@pocketjs/framework/components";
import HaIcon from "../icons/HaIcon.tsx";
import { computed } from "vue";
import type { TileCardConfig } from "../types/card.ts";
import type { EntityState } from "../types/entity.ts";
import { entityDomain, TOGGLE_DOMAINS } from "../types/entity.ts";
import {
  entityName,
  entityStateContentDisplay,
  isEntityOn,
  isToggleable,
  useEntity,
} from "../store/entity-store.ts";
import { useMoreInfo } from "../store/more-info-context.ts";
import type { DataSource } from "../store/data-source.ts";
import FeatureRenderer from "../renderer/FeatureRenderer.tsx";

export interface TileCardProps {
  config: TileCardConfig;
  entities: EntityState;
  source: DataSource;
}

// ── Color mapping ──────────────────────────────────────────────────
// HA tile cards accept named colors for the icon active state.
// Map to Tailwind-compatible bg classes.
const COLOR_ICON_BG: Record<string, string> = {
  red: "w-10 h-10 rounded-full bg-red-900 items-center justify-center",
  pink: "w-10 h-10 rounded-full bg-pink-900 items-center justify-center",
  purple: "w-10 h-10 rounded-full bg-purple-900 items-center justify-center",
  "deep-purple": "w-10 h-10 rounded-full bg-purple-900 items-center justify-center",
  indigo: "w-10 h-10 rounded-full bg-indigo-900 items-center justify-center",
  blue: "w-10 h-10 rounded-full bg-blue-900 items-center justify-center",
  "light-blue": "w-10 h-10 rounded-full bg-sky-900 items-center justify-center",
  cyan: "w-10 h-10 rounded-full bg-cyan-900 items-center justify-center",
  teal: "w-10 h-10 rounded-full bg-teal-900 items-center justify-center",
  green: "w-10 h-10 rounded-full bg-emerald-900 items-center justify-center",
  "light-green": "w-10 h-10 rounded-full bg-lime-900 items-center justify-center",
  lime: "w-10 h-10 rounded-full bg-lime-900 items-center justify-center",
  yellow: "w-10 h-10 rounded-full bg-yellow-900 items-center justify-center",
  amber: "w-10 h-10 rounded-full bg-amber-900 items-center justify-center",
  orange: "w-10 h-10 rounded-full bg-orange-900 items-center justify-center",
  "deep-orange": "w-10 h-10 rounded-full bg-orange-900 items-center justify-center",
  brown: "w-10 h-10 rounded-full bg-amber-950 items-center justify-center",
  grey: "w-10 h-10 rounded-full bg-slate-600 items-center justify-center",
  "dark-grey": "w-10 h-10 rounded-full bg-slate-700 items-center justify-center",
  "blue-grey": "w-10 h-10 rounded-full bg-slate-700 items-center justify-center",
};

const INACTIVE_ICON_BG = "w-10 h-10 rounded-full bg-slate-700 items-center justify-center";

// Domain-based default active colors (when no explicit color is set).
const DOMAIN_ACTIVE_BG: Record<string, string> = {
  light: "w-10 h-10 rounded-full bg-amber-900 items-center justify-center",
  climate: "w-10 h-10 rounded-full bg-orange-900 items-center justify-center",
  media_player: "w-10 h-10 rounded-full bg-blue-900 items-center justify-center",
  cover: "w-10 h-10 rounded-full bg-purple-900 items-center justify-center",
  fan: "w-10 h-10 rounded-full bg-teal-900 items-center justify-center",
  switch: "w-10 h-10 rounded-full bg-blue-900 items-center justify-center",
  lock: "w-10 h-10 rounded-full bg-red-900 items-center justify-center",
  alarm_control_panel: "w-10 h-10 rounded-full bg-red-900 items-center justify-center",
};

const DEFAULT_ACTIVE_BG = "w-10 h-10 rounded-full bg-blue-900 items-center justify-center";

export default function TileCard(props: TileCardProps) {
  const showMoreInfo = useMoreInfo();
  const entityRef = useEntity(props.entities, props.config.entity);
  const domain = entityDomain(props.config.entity);

  const name = computed(
    () => props.config.name ?? entityName(entityRef.value, props.config.entity),
  );
  const on = computed(() => isEntityOn(entityRef.value));
  const state = computed(() => {
    if (props.config.hide_state) return "";
    return entityStateContentDisplay(entityRef.value, props.config.state_content);
  });
  const canToggle = computed(() => isToggleable(entityRef.value));

  const features = props.config.features ?? [];

  const entityIcon = computed(() => entityRef.value?.attributes.icon as string | undefined);

  // Resolve icon color classes based on color config, domain, and active state.
  const cfgColor = props.config.color as string | undefined;

  const iconBg = computed(() => {
    const active = on.value;
    if (!active && !cfgColor) return INACTIVE_ICON_BG;
    // If entity is active or a color is explicitly set:
    // With explicit color, always use that color (HA shows colored icon even when off for sensor tiles).
    if (cfgColor) {
      return COLOR_ICON_BG[cfgColor] ?? (active ? DEFAULT_ACTIVE_BG : INACTIVE_ICON_BG);
    }
    return DOMAIN_ACTIVE_BG[domain] ?? DEFAULT_ACTIVE_BG;
  });

  function openMoreInfo() {
    showMoreInfo(props.config.entity);
  }

  function handleIconPress() {
    const entity = entityRef.value;
    if (!entity) return;

    if (!canToggle.value) {
      openMoreInfo();
      return;
    }

    if (domain === "cover") {
      const service = entity.state === "open" ? "close_cover" : "open_cover";
      props.source.callService("cover", service, {}, { entity_id: entity.entity_id });
      return;
    }

    const svcDomain = TOGGLE_DOMAINS.has(domain) ? domain : "homeassistant";
    const isOn = on.value;
    const service = isOn ? "turn_off" : "turn_on";
    props.source.callService(svcDomain, service, {}, { entity_id: entity.entity_id });
  }

  return (
    <View class="flex-col flex-1">
      {/* Main row: icon + name/state */}
      <View class="flex-row items-center gap-3 px-3 py-2">
        {/* Icon circle — toggles entity for toggle domains, else opens more-info */}
        <Focusable class={iconBg.value} onPress={handleIconPress}>
          <HaIcon icon={props.config.icon ?? entityIcon.value} domain={domain} size={22} />
        </Focusable>

        {/* Name + state — opens more-info */}
        <Focusable class="flex-col flex-1 focus:opacity-80" onPress={openMoreInfo}>
          <Text class="text-sm text-slate-100 font-bold" style={{ maxLines: 1 }}>
            {name.value}
          </Text>
          {state.value ? (
            <Text class="text-xs text-slate-400" style={{ maxLines: 1 }}>
              {state.value}
            </Text>
          ) : null}
        </Focusable>
      </View>

      {/* Features — nested Focusables take press priority */}
      {features.length > 0 ? (
        <View class="flex-col gap-1 px-2 pb-2">
          {features.map((f, i) => (
            <FeatureRenderer
              key={`f-${i}`}
              config={f}
              entity={entityRef.value}
              source={props.source}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}
