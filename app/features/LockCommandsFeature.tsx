import { View, Text, Focusable } from "@pocketjs/framework/components";
import type { HassEntity } from "../types/entity.ts";
import type { DataSource } from "../store/data-source.ts";

export interface LockCommandsFeatureProps {
  config: { type: "lock-commands" };
  entity: HassEntity | undefined;
  source: DataSource;
}

export default function LockCommandsFeature(props: LockCommandsFeatureProps) {
  const locked = props.entity?.state === "locked";

  function toggle() {
    if (!props.entity) return;
    const svc = locked ? "unlock" : "lock";
    props.source.callService("lock", svc, {}, { entity_id: props.entity.entity_id });
  }

  return (
    <View class="flex-row items-center justify-center">
      <Focusable
        class={
          locked
            ? "px-4 py-2 rounded-lg bg-emerald-900 focus:bg-emerald-800 active:bg-emerald-700"
            : "px-4 py-2 rounded-lg bg-amber-900 focus:bg-amber-800 active:bg-amber-700"
        }
        onPress={toggle}
      >
        <Text
          class={locked ? "text-xs text-emerald-300 font-bold" : "text-xs text-amber-300 font-bold"}
        >
          {locked ? "Unlock" : "Lock"}
        </Text>
      </Focusable>
    </View>
  );
}
