/**
 * Sidebar view — main content + sidebar split.
 * First card goes to sidebar, rest to main.
 */

import { View } from "@pocketjs/framework/components";
import type { LovelaceViewConfig } from "../types/view.ts";
import type { EntityState } from "../types/entity.ts";
import type { DataSource } from "../store/data-source.ts";
import CardRenderer from "../renderer/CardRenderer.tsx";

export interface SidebarViewProps {
  view: LovelaceViewConfig;
  entities: EntityState;
  source: DataSource;
  contentWidth: number;
}

export default function SidebarView(props: SidebarViewProps) {
  const cards = props.view.cards ?? [];
  const sidebarCard = cards[0];
  const mainCards = cards.slice(1);
  const sideW = Math.floor(props.contentWidth * 0.3);
  const mainW = props.contentWidth - sideW - 6;

  return (
    <View class="flex-row p-2" style={{ gap: 6 }}>
      {sidebarCard ? (
        <View style={{ width: sideW }}>
          <CardRenderer config={sidebarCard} entities={props.entities} source={props.source} />
        </View>
      ) : null}
      <View class="flex-col" style={{ width: mainW, gap: 6 }}>
        {mainCards.map((card, i) => (
          <View key={`main-${i}`} style={{ minHeight: 80 }}>
            <CardRenderer config={card} entities={props.entities} source={props.source} />
          </View>
        ))}
      </View>
    </View>
  );
}
