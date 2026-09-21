import { View, Text, Focusable } from "@pocketjs/framework/components";
import type { HassEntity } from "../types/entity.ts";
import type { DataSource } from "../store/data-source.ts";

export interface CoverOpenCloseFeatureProps {
  config: { type: "cover-open-close" };
  entity: HassEntity | undefined;
  source: DataSource;
}

export default function CoverOpenCloseFeature(props: CoverOpenCloseFeatureProps) {
  const isOpen = props.entity?.state === "open";

  function open() {
    if (!props.entity) return;
    props.source.callService("cover", "open_cover", {}, { entity_id: props.entity.entity_id });
  }

  function close() {
    if (!props.entity) return;
    props.source.callService("cover", "close_cover", {}, { entity_id: props.entity.entity_id });
  }

  function stop() {
    if (!props.entity) return;
    props.source.callService("cover", "stop_cover", {}, { entity_id: props.entity.entity_id });
  }

  return (
    <View class="flex-row gap-1 justify-center">
      <Focusable
        class={
          !isOpen
            ? "px-3 py-1 rounded-lg bg-slate-700 focus:bg-slate-600 active:bg-slate-500"
            : "px-3 py-1 rounded-lg bg-blue-900 focus:bg-blue-800 active:bg-blue-700"
        }
        onPress={open}
      >
        <Text class="text-xs text-slate-300 font-bold">{"\u25B2"}</Text>
      </Focusable>
      <Focusable
        class="px-3 py-1 rounded-lg bg-slate-700 focus:bg-slate-600 active:bg-slate-500"
        onPress={stop}
      >
        <Text class="text-xs text-slate-300 font-bold">{"\u25A0"}</Text>
      </Focusable>
      <Focusable
        class={
          isOpen
            ? "px-3 py-1 rounded-lg bg-slate-700 focus:bg-slate-600 active:bg-slate-500"
            : "px-3 py-1 rounded-lg bg-blue-900 focus:bg-blue-800 active:bg-blue-700"
        }
        onPress={close}
      >
        <Text class="text-xs text-slate-300 font-bold">{"\u25BC"}</Text>
      </Focusable>
    </View>
  );
}
