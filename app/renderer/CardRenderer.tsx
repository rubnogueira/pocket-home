/**
 * CardRenderer — resolves a card config to a PocketJS component.
 * Handles visibility conditions, wraps in a card surface, renders features.
 */

import { View, Text } from "@pocketjs/framework/components";
import type { LovelaceCardConfig, BaseCardConfig } from "../types/card.ts";
import type { EntityState } from "../types/entity.ts";
import { getCardComponent } from "../registry/card-registry.ts";
import { checkConditionsMet } from "../store/condition-engine.ts";
import type { DataSource } from "../store/data-source.ts";
import { HA_CARD_SHELL } from "../ui/tokens.ts";

// Card types that render without a card surface (transparent background).
const TRANSPARENT_TYPES = new Set(["heading"]);

export interface CardRendererProps {
  key?: string | number;
  config: LovelaceCardConfig;
  entities: EntityState;
  source: DataSource;
}

export default function CardRenderer(props: CardRendererProps) {
  const cfg = props.config as BaseCardConfig;

  if (cfg.visibility?.length) {
    const visible = checkConditionsMet(cfg.visibility, props.entities);
    if (!visible) return null;
  }

  if (cfg.disabled) {
    return (
      <View class="flex-1 flex-col items-center justify-center rounded-xl bg-slate-800 p-2">
        <Text class="text-xs text-slate-600">{cfg.type} (disabled)</Text>
      </View>
    );
  }

  const Comp = getCardComponent(cfg.type);
  const isTransparent = TRANSPARENT_TYPES.has(cfg.type);

  if (isTransparent) {
    return (
      <View class="flex-col overflow-hidden">
        <Comp config={props.config} entities={props.entities} source={props.source} />
      </View>
    );
  }

  return (
    <View class={HA_CARD_SHELL}>
      <Comp config={props.config} entities={props.entities} source={props.source} />
    </View>
  );
}
