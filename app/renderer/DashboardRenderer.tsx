/**
 * DashboardRenderer — root component that renders the current view.
 * Shows view tabs at the top, then delegates to ViewRenderer.
 */

import { computed } from "vue";
import { View, Text, Focusable } from "@pocketjs/framework/components";
import type { LovelaceDashboardConfig } from "../types/dashboard.ts";
import type { EntityState } from "../types/entity.ts";
import type { DataSource } from "../store/data-source.ts";
import ViewRenderer from "./ViewRenderer.tsx";

export interface DashboardRendererProps {
  config: LovelaceDashboardConfig | null;
  viewIndex: number;
  entities: EntityState;
  entityVersion?: number;
  source: DataSource;
  contentWidth: number;
  cols: number;
  editMode: boolean;
  onViewChange: (index: number) => void;
  onSectionConfigChange: (sectionIndex: number, key: string, value: unknown) => void;
  onCardReorder: (sectionIndex: number, fromIdx: number, toIdx: number) => void;
}

export default function DashboardRenderer(props: DashboardRendererProps) {
  const views = computed(() => props.config?.views ?? []);
  const currentView = computed(() => views.value[props.viewIndex]);

  return (
    <View class="flex-col flex-1">
      {!props.config ? (
        <View class="flex-1 flex-col items-center justify-center">
          <Text class="text-sm text-slate-500">Loading dashboard...</Text>
        </View>
      ) : !currentView.value ? (
        <View class="flex-1 flex-col items-center justify-center">
          <Text class="text-sm text-slate-500">No views configured</Text>
        </View>
      ) : (
        <>
          {/* View tabs — only show if more than 1 view */}
          {views.value.length > 1 ? (
            <View class="flex-row gap-1 px-2 py-1">
              {views.value.map((v, i) => (
                <Focusable
                  key={`tab-${i}`}
                  class={
                    i === props.viewIndex
                      ? "px-3 py-1 rounded-lg bg-blue-600 focus:bg-blue-500 active:bg-blue-500"
                      : "px-3 py-1 rounded-lg bg-slate-800 focus:bg-slate-700 active:bg-slate-600"
                  }
                  onPress={() => props.onViewChange(i)}
                >
                  <Text
                    class={
                      i === props.viewIndex
                        ? "text-xs text-slate-50 font-bold"
                        : "text-xs text-slate-400"
                    }
                  >
                    {v.title ?? v.path ?? `View ${i + 1}`}
                  </Text>
                </Focusable>
              ))}
            </View>
          ) : null}

          <ViewRenderer
            view={currentView.value}
            entities={props.entities}
            entityVersion={props.entityVersion}
            source={props.source}
            contentWidth={props.contentWidth}
            cols={props.cols}
            editMode={props.editMode}
            onSectionConfigChange={props.onSectionConfigChange}
            onCardReorder={props.onCardReorder}
          />
        </>
      )}
    </View>
  );
}
