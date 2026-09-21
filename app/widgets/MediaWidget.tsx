import { ref } from "vue";
import { Text, View, Focusable } from "@pocketjs/framework/components";
import { Badge, Progress, Slider } from "../ui/index.ts";
import { ICON_BTN_ROUND } from "../ui/tokens.ts";

interface Track {
  title: string;
  artist: string;
  duration: string;
}

const PLAYLIST: Track[] = [
  { title: "Ambient Living", artist: "Chill Zones", duration: "3:42" },
  { title: "Morning Jazz", artist: "Cafe Beats", duration: "4:15" },
  { title: "Focus Flow", artist: "Deep Work", duration: "5:01" },
  { title: "Evening Classics", artist: "Piano Moods", duration: "6:22" },
];

export default function MediaWidget() {
  const playing = ref(false);
  const trackIdx = ref(0);
  const progress = ref(35);
  const volume = ref(70);

  function togglePlay(): void {
    playing.value = !playing.value;
  }
  function nextTrack(): void {
    trackIdx.value = (trackIdx.value + 1) % PLAYLIST.length;
    progress.value = 0;
  }
  function prevTrack(): void {
    trackIdx.value = (trackIdx.value - 1 + PLAYLIST.length) % PLAYLIST.length;
    progress.value = 0;
  }
  const track = () => PLAYLIST[trackIdx.value];

  return (
    <View class="flex-col flex-1 gap-3">
      <View class="flex-col gap-1">
        <Badge
          label={playing.value ? "Now Playing" : "Paused"}
          variant={playing.value ? "default" : "muted"}
        />
        <Text class="text-lg text-slate-50 font-bold">{track().title}</Text>
        <Text class="text-sm text-slate-400">{track().artist}</Text>
      </View>

      <Progress value={progress.value} label="Track" showValue />

      <View class="flex-row items-center justify-center gap-4">
        <Focusable class={ICON_BTN_ROUND} onPress={prevTrack}>
          <Text class="text-base text-slate-300">{"<<"}</Text>
        </Focusable>
        <Focusable
          class={
            playing.value
              ? "w-12 h-12 rounded-full bg-blue-500 items-center justify-center focus:bg-blue-400 active:bg-blue-600"
              : "w-12 h-12 rounded-full bg-slate-700 items-center justify-center focus:bg-slate-600 active:bg-slate-800"
          }
          onPress={togglePlay}
        >
          <Text class="text-lg text-white font-bold">{playing.value ? "||" : ">"}</Text>
        </Focusable>
        <Focusable class={ICON_BTN_ROUND} onPress={nextTrack}>
          <Text class="text-base text-slate-300">{">>"}</Text>
        </Focusable>
      </View>

      <Slider
        label="Volume"
        value={volume.value}
        min={0}
        max={100}
        step={5}
        onValueChange={(v) => {
          volume.value = v;
        }}
      />
    </View>
  );
}
