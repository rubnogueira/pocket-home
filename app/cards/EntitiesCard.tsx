import { View, Text } from "@pocketjs/framework/components";
import type { EntitiesCardConfig } from "../types/card.ts";
import type { EntityState } from "../types/entity.ts";
import type { DataSource } from "../store/data-source.ts";
import RowRenderer from "../renderer/RowRenderer.tsx";
import { Separator } from "../ui/index.ts";

export interface EntitiesCardProps {
  config: EntitiesCardConfig;
  entities: EntityState;
  source: DataSource;
}

export default function EntitiesCard(props: EntitiesCardProps) {
  const rows = props.config.entities ?? [];
  const title = props.config.title;

  return (
    <View class="flex-col">
      {title ? (
        <View class="px-3 py-2">
          <Text class="text-sm text-slate-100 font-bold">{title}</Text>
        </View>
      ) : null}
      <View class="flex-col">
        {rows.map((row, i) => (
          <View key={`row-${i}`}>
            {i > 0 ? <Separator /> : null}
            <RowRenderer config={row} entities={props.entities} source={props.source} />
          </View>
        ))}
      </View>
    </View>
  );
}
