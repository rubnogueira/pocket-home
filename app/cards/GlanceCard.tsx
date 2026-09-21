import { View, Text, Focusable } from "@pocketjs/framework/components";
import { computed } from "vue";
import type { GlanceCardConfig, GlanceEntity } from "../types/card.ts";
import type { EntityState, HassEntity } from "../types/entity.ts";
import { entityDomain } from "../types/entity.ts";
import { entityName, entityStateDisplay, isEntityOn } from "../store/entity-store.ts";
import { executeAction, defaultTapAction } from "../store/action-dispatcher.ts";
import { useMoreInfo } from "../store/more-info-context.ts";
import type { DataSource } from "../store/data-source.ts";
import HaIcon from "../icons/HaIcon.tsx";

export interface GlanceCardProps {
  config: GlanceCardConfig;
  entities: EntityState;
  source: DataSource;
}

export default function GlanceCard(props: GlanceCardProps) {
  const showMoreInfo = useMoreInfo();
  const title = props.config.title;
  const showName = props.config.show_name !== false;
  const showState = props.config.show_state !== false;
  const items = props.config.entities ?? [];

  const entityRefs = items.map((item) => {
    const eid = typeof item === "string" ? item : item.entity;
    return computed(() => props.entities[eid] as HassEntity | undefined);
  });

  return (
    <View class="flex-col">
      {title ? (
        <View class="px-3 py-2">
          <Text class="text-sm text-slate-100 font-bold">{title}</Text>
        </View>
      ) : null}
      <View class="flex-row flex-wrap px-2 py-2 gap-2">
        {items.map((item, i) => {
          const eid = typeof item === "string" ? item : item.entity;
          const entityRef = entityRefs[i];
          const cfg = typeof item === "string" ? {} : item;
          const itemName = computed(
            () => (cfg as GlanceEntity).name ?? entityName(entityRef.value, eid),
          );
          const on = computed(() => isEntityOn(entityRef.value));
          const stateStr = computed(() => entityStateDisplay(entityRef.value));

          function handleTap() {
            const action = (cfg as GlanceEntity).tap_action ?? defaultTapAction(entityRef.value);
            executeAction(action, { entity: entityRef.value, source: props.source, showMoreInfo });
          }

          return (
            <Focusable
              key={`g-${i}`}
              class="flex-col items-center gap-1 p-2 rounded-xl focus:bg-slate-700 active:bg-slate-600"
              style={{ width: 60 }}
              onPress={handleTap}
            >
              <View
                class={
                  on.value
                    ? "w-8 h-8 rounded-full bg-amber-900 items-center justify-center"
                    : "w-8 h-8 rounded-full bg-slate-700 items-center justify-center"
                }
              >
                <HaIcon
                  icon={
                    (cfg as GlanceEntity).icon ??
                    (entityRef.value?.attributes.icon as string | undefined)
                  }
                  domain={entityDomain(eid)}
                  size={18}
                />
              </View>
              {showName ? (
                <Text class="text-xs text-slate-300 text-center" style={{ maxLines: 1 }}>
                  {itemName.value}
                </Text>
              ) : null}
              {showState ? (
                <Text class="text-xs text-slate-500 text-center" style={{ maxLines: 1 }}>
                  {stateStr.value}
                </Text>
              ) : null}
            </Focusable>
          );
        })}
      </View>
    </View>
  );
}
