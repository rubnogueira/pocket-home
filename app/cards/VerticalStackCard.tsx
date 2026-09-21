import { View, Text } from "@pocketjs/framework/components";
import type { VerticalStackCardConfig } from "../types/card.ts";
import type { EntityState } from "../types/entity.ts";
import type { DataSource } from "../store/data-source.ts";
import CardRenderer from "../renderer/CardRenderer.tsx";

export interface VerticalStackCardProps {
  config: VerticalStackCardConfig;
  entities: EntityState;
  source: DataSource;
}

export default function VerticalStackCard(props: VerticalStackCardProps) {
  const cards = props.config.cards ?? [];
  return (
    <View class="flex-col flex-1 gap-2">
      {props.config.title ? (
        <View class="px-3 py-1">
          <Text class="text-sm text-slate-100 font-bold">{props.config.title}</Text>
        </View>
      ) : null}
      {cards.map((card, i) => (
        <View key={`vs-${i}`} style={{ minHeight: 60 }}>
          <CardRenderer config={card} entities={props.entities} source={props.source} />
        </View>
      ))}
    </View>
  );
}
