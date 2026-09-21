import { View, Text } from "@pocketjs/framework/components";
import type { AreaCardConfig } from "../types/card.ts";
import type { EntityState } from "../types/entity.ts";
import type { DataSource } from "../store/data-source.ts";
import FeatureRenderer from "../renderer/FeatureRenderer.tsx";

export interface AreaCardProps {
  config: AreaCardConfig;
  entities: EntityState;
  source: DataSource;
}

export default function AreaCard(props: AreaCardProps) {
  const name = props.config.name ?? props.config.area;
  const features = props.config.features ?? [];

  return (
    <View class="flex-col flex-1 p-3 gap-2">
      <Text class="text-sm text-slate-100 font-bold">{name}</Text>
      <Text class="text-xs text-slate-400">Area: {props.config.area}</Text>
      {features.length > 0 ? (
        <View class="flex-col gap-1">
          {features.map((f, i) => (
            <FeatureRenderer key={`f-${i}`} config={f} entity={undefined} source={props.source} />
          ))}
        </View>
      ) : null}
    </View>
  );
}
