import { View, Text } from "@pocketjs/framework/components";
import type { SectionCardConfig } from "../types/card.ts";
import type { EntityState } from "../types/entity.ts";
import type { DataSource } from "../store/data-source.ts";
import CardRenderer from "../renderer/CardRenderer.tsx";

export interface SectionCardProps {
  config: SectionCardConfig;
  entities: EntityState;
  source: DataSource;
}

export default function SectionCard(props: SectionCardProps) {
  const cards = props.config.cards ?? [];
  const title = props.config.title;

  return (
    <View class="flex-col flex-1 gap-2">
      {title ? (
        <View class="px-2 py-1">
          <Text class="text-sm text-slate-300 font-bold">{title}</Text>
        </View>
      ) : null}
      <View class="flex-col gap-2">
        {cards.map((card, i) => (
          <View key={`sec-${i}`} style={{ minHeight: 60 }}>
            <CardRenderer config={card} entities={props.entities} source={props.source} />
          </View>
        ))}
      </View>
    </View>
  );
}
