import { View, Text } from "@pocketjs/framework/components";
import type { EntityFilterCardConfig } from "../types/card.ts";
import type { EntityState } from "../types/entity.ts";
import type { DataSource } from "../store/data-source.ts";
import RowRenderer from "../renderer/RowRenderer.tsx";
import { Separator } from "../ui/index.ts";

export interface EntityFilterCardProps {
  config: EntityFilterCardConfig;
  entities: EntityState;
  source: DataSource;
}

export default function EntityFilterCard(props: EntityFilterCardProps) {
  const entities = props.config.entities ?? [];
  const filters = props.config.state_filter ?? [];

  const matching = entities.filter((e) => {
    const eid = typeof e === "string" ? e : ((e as { entity?: string }).entity ?? "");
    const entity = props.entities[eid];
    if (!entity) return false;
    if (!filters.length) return true;
    return filters.some((f) => {
      if (typeof f === "string") return entity.state === f;
      return true;
    });
  });

  if (!matching.length && props.config.show_empty === false) return null;

  return (
    <View class="flex-col">
      {matching.length === 0 ? (
        <View class="items-center justify-center p-3">
          <Text class="text-xs text-slate-500">No matching entities</Text>
        </View>
      ) : (
        matching.map((row, i) => (
          <View key={`ef-${i}`}>
            {i > 0 ? <Separator /> : null}
            <RowRenderer config={row} entities={props.entities} source={props.source} />
          </View>
        ))
      )}
    </View>
  );
}
