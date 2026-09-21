import { View, Text } from "@pocketjs/framework/components";
import type { GridCardConfig } from "../types/card.ts";
import type { EntityState } from "../types/entity.ts";
import type { DataSource } from "../store/data-source.ts";
import CardRenderer from "../renderer/CardRenderer.tsx";

export interface GridCardProps {
  config: GridCardConfig;
  entities: EntityState;
  source: DataSource;
}

export default function GridCard(props: GridCardProps) {
  const cards = props.config.cards ?? [];
  const title = props.config.title;

  return (
    <View class="flex-col">
      {title ? (
        <View class="px-3 py-2">
          <Text class="text-sm text-slate-100 font-bold">{title}</Text>
        </View>
      ) : null}
      <View class="flex-row flex-wrap gap-2 p-2">
        {cards.map((card, i) => (
          <View key={`grid-${i}`} style={{ minWidth: 100, minHeight: 80 }} class="flex-1">
            <CardRenderer config={card} entities={props.entities} source={props.source} />
          </View>
        ))}
      </View>
    </View>
  );
}
