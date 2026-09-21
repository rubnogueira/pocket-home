/**
 * Masonry view layout — cards flow into columns.
 */

import { View } from "@pocketjs/framework/components";
import type { LovelaceViewConfig } from "../types/view.ts";
import type { EntityState } from "../types/entity.ts";
import type { DataSource } from "../store/data-source.ts";
import CardRenderer from "../renderer/CardRenderer.tsx";

export interface MasonryViewProps {
  view: LovelaceViewConfig;
  entities: EntityState;
  source: DataSource;
  contentWidth: number;
  cols: number;
  gap?: number;
  padding?: number;
}

export default function MasonryView(props: MasonryViewProps) {
  const gap = props.gap ?? 6;
  const padding = props.padding ?? 8;
  const cards = props.view.cards ?? [];
  const cols = Math.max(1, Math.min(props.cols, 4));
  const colW = Math.floor((props.contentWidth - padding * 2 - (cols - 1) * gap) / cols);

  // Distribute cards round-robin into columns.
  const columns: (typeof cards)[] = Array.from({ length: cols }, () => []);
  cards.forEach((card, i) => {
    columns[i % cols].push(card);
  });

  return (
    <View class="flex-row" style={{ gap, padding }}>
      {columns.map((colCards, ci) => (
        <View key={`col-${ci}`} class="flex-col" style={{ width: colW, gap }}>
          {colCards.map((card, i) => (
            <View key={`card-${ci}-${i}`} style={{ minHeight: 80 }}>
              <CardRenderer config={card} entities={props.entities} source={props.source} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}
