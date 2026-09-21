import { ref } from "vue";
import { Text, View, Focusable } from "@pocketjs/framework/components";
import {
  CHIP_ACTION_BLUE,
  CHIP_ACTIVE_BLUE,
  CHIP_INACTIVE,
  ROW_ACTIVE_BLUE,
  ROW_INACTIVE,
} from "../ui/tokens.ts";

interface Scene {
  id: string;
  name: string;
  desc: string;
}

const SCENES: Scene[] = [
  { id: "s1", name: "Morning", desc: "Lights 80%, blinds open" },
  { id: "s2", name: "Movie", desc: "Dim lights, TV on" },
  { id: "s3", name: "Night", desc: "All off, security armed" },
  { id: "s4", name: "Away", desc: "Locked, cameras on" },
  { id: "s5", name: "Party", desc: "Colored lights, music" },
  { id: "s6", name: "Focus", desc: "Office only, DND on" },
];

export default function ScenesWidget() {
  const activeScene = ref<string | null>(null);

  function activate(id: string): void {
    activeScene.value = activeScene.value === id ? null : id;
  }

  return (
    <View class="flex-col flex-1 gap-1">
      <View class="flex-row items-center justify-between pb-1">
        <Text class="text-sm text-slate-300 font-bold">Scenes</Text>
        {activeScene.value ? (
          <Focusable
            class={CHIP_ACTION_BLUE}
            onPress={() => {
              activeScene.value = null;
            }}
          >
            <Text class="text-xs text-blue-300 font-bold">Deactivate</Text>
          </Focusable>
        ) : (
          <Text class="text-xs text-slate-500">None active</Text>
        )}
      </View>

      {/* Lovelace-style scene rows */}
      <View class="flex-col gap-1 flex-1">
        {SCENES.map((scene) => {
          const isActive = activeScene.value === scene.id;
          return (
            <Focusable
              key={scene.id}
              class={isActive ? ROW_ACTIVE_BLUE : ROW_INACTIVE}
              onPress={() => activate(scene.id)}
            >
              <View class="flex-col flex-1">
                <Text
                  class={isActive ? "text-sm text-blue-200 font-bold" : "text-sm text-slate-200"}
                >
                  {scene.name}
                </Text>
                <Text class="text-xs text-slate-500">{scene.desc}</Text>
              </View>
              {isActive ? (
                <View class={CHIP_ACTIVE_BLUE}>
                  <Text class="text-xs text-blue-300 font-bold">Active</Text>
                </View>
              ) : (
                <View class={CHIP_INACTIVE}>
                  <Text class="text-xs text-slate-500">Run</Text>
                </View>
              )}
            </Focusable>
          );
        })}
      </View>
    </View>
  );
}
