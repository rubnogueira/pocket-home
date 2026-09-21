import { View, Text, Focusable } from "@pocketjs/framework/components";
import type { HassEntity } from "../types/entity.ts";
import type { DataSource } from "../store/data-source.ts";

export interface MediaPlaybackFeatureProps {
  config: { type: "media-player-playback" };
  entity: HassEntity | undefined;
  source: DataSource;
}

export default function MediaPlaybackFeature(props: MediaPlaybackFeatureProps) {
  const playing = props.entity?.state === "playing";

  function prev() {
    if (!props.entity) return;
    props.source.callService(
      "media_player",
      "media_previous_track",
      {},
      { entity_id: props.entity.entity_id },
    );
  }
  function playPause() {
    if (!props.entity) return;
    props.source.callService(
      "media_player",
      "media_play_pause",
      {},
      { entity_id: props.entity.entity_id },
    );
  }
  function next() {
    if (!props.entity) return;
    props.source.callService(
      "media_player",
      "media_next_track",
      {},
      { entity_id: props.entity.entity_id },
    );
  }

  return (
    <View class="flex-row gap-2 items-center justify-center">
      <Focusable
        class="w-8 h-8 rounded-full bg-slate-700 items-center justify-center focus:bg-slate-600 active:bg-slate-500"
        onPress={prev}
      >
        <Text class="text-xs text-slate-300 font-bold">{"\u23EE"}</Text>
      </Focusable>
      <Focusable
        class="w-10 h-10 rounded-full bg-blue-600 items-center justify-center focus:bg-blue-500 active:bg-blue-500"
        onPress={playPause}
      >
        <Text class="text-sm text-white font-bold">{playing ? "\u23F8" : "\u25B6"}</Text>
      </Focusable>
      <Focusable
        class="w-8 h-8 rounded-full bg-slate-700 items-center justify-center focus:bg-slate-600 active:bg-slate-500"
        onPress={next}
      >
        <Text class="text-xs text-slate-300 font-bold">{"\u23ED"}</Text>
      </Focusable>
    </View>
  );
}
