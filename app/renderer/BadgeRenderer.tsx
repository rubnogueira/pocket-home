import { View, Text } from "@pocketjs/framework/components";
import type { LovelaceBadgeConfig } from "../types/badge.ts";
import type { EntityState } from "../types/entity.ts";
import { getBadgeComponent } from "../registry/badge-registry.ts";
import type { DataSource } from "../store/data-source.ts";

export interface BadgeRendererProps {
  key?: string | number;
  config: LovelaceBadgeConfig | string;
  entities: EntityState;
  source: DataSource;
}

export default function BadgeRenderer(props: BadgeRendererProps) {
  // String shorthand → entity badge.
  const cfg: LovelaceBadgeConfig =
    typeof props.config === "string"
      ? ({ type: "entity", entity: props.config } as LovelaceBadgeConfig)
      : props.config;

  const Comp = getBadgeComponent(cfg.type);
  if (!Comp) {
    return (
      <View class="px-2 py-1 rounded-lg bg-slate-700">
        <Text class="text-xs text-slate-400">{cfg.type}</Text>
      </View>
    );
  }

  return <Comp config={cfg} entities={props.entities} source={props.source} />;
}
