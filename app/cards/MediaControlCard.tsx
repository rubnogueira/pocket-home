import { View, Text, Focusable } from "@pocketjs/framework/components";
import { computed } from "vue";
import type { MediaControlCardConfig } from "../types/card.ts";
import type { EntityState, HassEntity } from "../types/entity.ts";
import { entityName } from "../store/entity-store.ts";
import { useMoreInfo } from "../store/more-info-context.ts";
import type { DataSource } from "../store/data-source.ts";
import { HA_CARD_PRESS_GAP3 } from "../ui/tokens.ts";
import { Progress } from "../ui/index.ts";

export interface MediaControlCardProps {
  config: MediaControlCardConfig;
  entities: EntityState;
  source: DataSource;
}

export default function MediaControlCard(props: MediaControlCardProps) {
  const showMoreInfo = useMoreInfo();
  const entity = computed(() => props.entities[props.config.entity] as HassEntity | undefined);
  const name = computed(() => entityName(entity.value, props.config.entity));
  const playing = computed(() => entity.value?.state === "playing");
  const title = computed(() => entity.value?.attributes.media_title as string | undefined);
  const artist = computed(() => entity.value?.attributes.media_artist as string | undefined);
  const vol = computed(() => (entity.value?.attributes.volume_level as number) ?? 0);
  const pct = computed(() => Math.round(vol.value * 100));
  const stateStr = computed(() => entity.value?.state ?? "unavailable");

  function svc(service: string) {
    if (!entity.value) return;
    props.source.callService("media_player", service, {}, { entity_id: entity.value.entity_id });
  }

  function handleTap() {
    if (entity.value) showMoreInfo(entity.value.entity_id);
  }

  return (
    <Focusable class={HA_CARD_PRESS_GAP3} onPress={handleTap}>
      <Text class="text-sm text-slate-100 font-bold">{name.value}</Text>
      {title.value ? (
        <View class="flex-col">
          <Text class="text-sm text-slate-200 font-bold">{title.value}</Text>
          {artist.value ? <Text class="text-xs text-slate-400">{artist.value}</Text> : null}
        </View>
      ) : (
        <Text class="text-xs text-slate-500">{stateStr.value}</Text>
      )}
      <View class="flex-row gap-2 items-center justify-center">
        <Focusable
          class="w-8 h-8 rounded-full bg-slate-700 items-center justify-center focus:bg-slate-600 active:bg-slate-500"
          onPress={() => svc("media_previous_track")}
        >
          <Text class="text-xs text-slate-300 font-bold">{"\u23EE"}</Text>
        </Focusable>
        <Focusable
          class="w-10 h-10 rounded-full bg-blue-600 items-center justify-center focus:bg-blue-500 active:bg-blue-500"
          onPress={() => svc("media_play_pause")}
        >
          <Text class="text-sm text-white font-bold">{playing.value ? "\u23F8" : "\u25B6"}</Text>
        </Focusable>
        <Focusable
          class="w-8 h-8 rounded-full bg-slate-700 items-center justify-center focus:bg-slate-600 active:bg-slate-500"
          onPress={() => svc("media_next_track")}
        >
          <Text class="text-xs text-slate-300 font-bold">{"\u23ED"}</Text>
        </Focusable>
      </View>
      <View class="flex-row items-center gap-2">
        <Text class="text-xs text-slate-500">Vol</Text>
        <View class="flex-1">
          <Progress value={pct.value} max={100} />
        </View>
        <Text class="text-xs text-slate-400">{pct.value}%</Text>
      </View>
    </Focusable>
  );
}
