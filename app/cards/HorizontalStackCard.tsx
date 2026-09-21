import { View, Text } from "@pocketjs/framework/components";
import type { HorizontalStackCardConfig } from "../types/card.ts";
import type { EntityState } from "../types/entity.ts";
import type { DataSource } from "../store/data-source.ts";
import CardRenderer from "../renderer/CardRenderer.tsx";

export interface HorizontalStackCardProps {
  config: HorizontalStackCardConfig;
  entities: EntityState;
  source: DataSource;
}

export default function HorizontalStackCard(props: HorizontalStackCardProps) {
  const cards = props.config.cards ?? [];
  return (
    <View class="flex-col">
      {props.config.title ? (
        <View class="px-3 py-1">
          <Text class="text-sm text-slate-100 font-bold">{props.config.title}</Text>
        </View>
      ) : null}
      <View class="flex-row gap-2">
        {cards.map((card, i) => (
          <View key={`hs-${i}`} class="flex-1" style={{ minHeight: 60 }}>
            <CardRenderer config={card} entities={props.entities} source={props.source} />
          </View>
        ))}
      </View>
    </View>
  );
}
