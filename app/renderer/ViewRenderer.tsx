/**
 * ViewRenderer — dispatches to the correct view layout (sections/masonry/panel/sidebar).
 */

import { computed } from "vue";
import { View } from "@pocketjs/framework/components";
import type { LovelaceViewConfig } from "../types/view.ts";
import type { EntityState } from "../types/entity.ts";
import type { DataSource } from "../store/data-source.ts";
import SectionsView from "../views/SectionsView.tsx";
import MasonryView from "../views/MasonryView.tsx";
import PanelView from "../views/PanelView.tsx";
import SidebarView from "../views/SidebarView.tsx";
import BadgeRenderer from "./BadgeRenderer.tsx";

export interface ViewRendererProps {
  view: LovelaceViewConfig;
  entities: EntityState;
  entityVersion?: number;
  source: DataSource;
  contentWidth: number;
  cols: number;
  editMode: boolean;
  onSectionConfigChange: (sectionIndex: number, key: string, value: unknown) => void;
  onCardReorder: (sectionIndex: number, fromIdx: number, toIdx: number) => void;
}

export default function ViewRenderer(props: ViewRendererProps) {
  const badges = computed(() => props.view.badges ?? []);

  const edgePad = computed(() => {
    const cw = props.contentWidth;
    return cw >= 1100 ? 80 : cw >= 700 ? 48 : cw >= 400 ? 24 : 12;
  });

  return (
    <View class="flex-col flex-1">
      {/* Badges row — aligned with section content via spacers */}
      {badges.value.length > 0 ? (
        <View
          class="flex-row flex-wrap gap-2 py-2 overflow-hidden"
          style={{ paddingL: edgePad.value, paddingR: edgePad.value }}
        >
          {badges.value.map((badge, i) => (
            <BadgeRenderer
              key={`badge-${i}`}
              config={badge}
              entities={props.entities}
              source={props.source}
            />
          ))}
        </View>
      ) : null}

      {/* View content */}
      {renderViewContent(props)}
    </View>
  );
}

function renderViewContent(props: ViewRendererProps) {
  const type = props.view.type ?? "sections";

  switch (type) {
    case "masonry":
      return (
        <MasonryView
          view={props.view}
          entities={props.entities}
          source={props.source}
          contentWidth={props.contentWidth}
          cols={props.cols}
        />
      );
    case "panel":
      return (
        <PanelView
          view={props.view}
          entities={props.entities}
          source={props.source}
          contentWidth={props.contentWidth}
        />
      );
    case "sidebar":
      return (
        <SidebarView
          view={props.view}
          entities={props.entities}
          source={props.source}
          contentWidth={props.contentWidth}
        />
      );
    case "sections":
    default:
      return (
        <SectionsView
          view={props.view}
          entities={props.entities}
          source={props.source}
          contentWidth={props.contentWidth}
          editMode={props.editMode}
          onSectionConfigChange={props.onSectionConfigChange}
          onCardReorder={props.onCardReorder}
        />
      );
  }
}
