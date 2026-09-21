import { View, Text, Focusable } from "@pocketjs/framework/components";
import { computed } from "vue";
import type { EntityRowConfig } from "../types/row.ts";
import type { EntityState, HassEntity } from "../types/entity.ts";
import { entityName } from "../store/entity-store.ts";
import { useMoreInfo } from "../store/more-info-context.ts";
import type { DataSource } from "../store/data-source.ts";

export interface MediaPlayerEntityRowProps {
  config: EntityRowConfig;
  entities: EntityState;
  source: DataSource;
}

export default function MediaPlayerEntityRow(props: MediaPlayerEntityRowProps) {
  const showMoreInfo = useMoreInfo();
  const entity = computed(
    () =>
      (props.config.entity ? props.entities[props.config.entity] : undefined) as
        | HassEntity
        | undefined,
  );
  const name = computed(
    () => props.config.name ?? entityName(entity.value, props.config.entity ?? ""),
  );
  const playing = computed(() => entity.value?.state === "playing");
  const title = computed(() => entity.value?.attributes.media_title as string | undefined);

  function playPause() {
    if (!entity.value) return;
    props.source.callService(
      "media_player",
      "media_play_pause",
      {},
      { entity_id: entity.value.entity_id },
    );
  }

  function handleRowTap() {
    if (props.config.entity) showMoreInfo(props.config.entity);
  }

  return (
    <View class="flex-row items-center justify-between px-3 py-2">
      <Focusable
        class="flex-col flex-1 rounded-lg focus:bg-slate-700 active:bg-slate-600 py-1"
        onPress={handleRowTap}
      >
        <Text class="text-sm text-slate-200" style={{ maxLines: 1 }}>
          {name.value}
        </Text>
        {title.value ? (
          <Text class="text-xs text-slate-400" style={{ maxLines: 1 }}>
            {title.value}
          </Text>
        ) : null}
      </Focusable>
      <Focusable
        class="w-8 h-8 rounded-full bg-slate-700 items-center justify-center focus:bg-slate-600 active:bg-slate-500"
        onPress={playPause}
      >
        <Text class="text-xs text-slate-300 font-bold">{playing.value ? "\u23F8" : "\u25B6"}</Text>
      </Focusable>
    </View>
  );
}
