/**
 * Panel view — a single card fills the view.
 */

import { View } from "@pocketjs/framework/components";
import type { LovelaceViewConfig } from "../types/view.ts";
import type { EntityState } from "../types/entity.ts";
import type { DataSource } from "../store/data-source.ts";
import CardRenderer from "../renderer/CardRenderer.tsx";

export interface PanelViewProps {
  view: LovelaceViewConfig;
  entities: EntityState;
  source: DataSource;
  contentWidth: number;
}

export default function PanelView(props: PanelViewProps) {
  const cards = props.view.cards ?? [];
  const card = cards[0];
  if (!card) return <View class="flex-1" />;

  return (
    <View class="flex-1 p-2">
      <CardRenderer config={card} entities={props.entities} source={props.source} />
    </View>
  );
}
