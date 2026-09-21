import { View, Text } from "@pocketjs/framework/components";
import type { LovelaceCardFeatureConfig } from "../types/feature.ts";
import type { HassEntity } from "../types/entity.ts";
import { getFeatureComponent } from "../registry/feature-registry.ts";
import type { DataSource } from "../store/data-source.ts";

export interface FeatureRendererProps {
  key?: string | number;
  config: LovelaceCardFeatureConfig;
  entity: HassEntity | undefined;
  source: DataSource;
}

export default function FeatureRenderer(props: FeatureRendererProps) {
  const Comp = getFeatureComponent(props.config.type);
  if (!Comp) {
    return (
      <View class="px-2 py-1">
        <Text class="text-xs text-slate-600">{props.config.type}</Text>
      </View>
    );
  }
  return <Comp config={props.config} entity={props.entity} source={props.source} />;
}
