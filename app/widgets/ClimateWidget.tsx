import { ref } from "vue";
import { Text, View, Focusable } from "@pocketjs/framework/components";
import { Tabs, TabsList, TabsTrigger } from "../ui/index.ts";
import { ICON_BTN, SURFACE_INSET } from "../ui/tokens.ts";

type HvacMode = "heat" | "cool" | "auto" | "off";

interface ThermostatState {
  target: number;
  current: number;
  humidity: number;
  mode: HvacMode;
}

const MODE_LABELS: Record<HvacMode, string> = {
  heat: "Heating",
  cool: "Cooling",
  auto: "Auto",
  off: "Off",
};

const MODES: HvacMode[] = ["heat", "cool", "auto", "off"];

export default function ClimateWidget() {
  const state = ref<ThermostatState>({
    target: 22,
    current: 21,
    humidity: 45,
    mode: "auto",
  });

  function setTarget(delta: number): void {
    const next = state.value.target + delta;
    if (next >= 16 && next <= 30) {
      state.value = { ...state.value, target: next };
    }
  }

  function setMode(mode: string): void {
    if (MODES.includes(mode as HvacMode)) {
      state.value = { ...state.value, mode: mode as HvacMode };
    }
  }

  return (
    <View class="flex-col flex-1 gap-3">
      <View class="flex-row items-center justify-between">
        <View class="flex-col">
          <View class="flex-row items-end gap-1">
            <Text class="text-5xl text-slate-50 font-bold">{String(state.value.target)}</Text>
            <Text class="text-2xl text-slate-400 pb-1">{"°C"}</Text>
          </View>
          <Text class="text-xs text-slate-500">Target temperature</Text>
        </View>

        <View class="flex-col gap-2">
          <Focusable class={ICON_BTN} onPress={() => setTarget(1)}>
            <Text class="text-lg text-slate-300 font-bold">+</Text>
          </Focusable>
          <Focusable class={ICON_BTN} onPress={() => setTarget(-1)}>
            <Text class="text-lg text-slate-300 font-bold">-</Text>
          </Focusable>
        </View>
      </View>

      <View class="flex-row gap-3">
        <View class={SURFACE_INSET}>
          <Text class="text-lg text-cyan-400 font-bold">{`${state.value.current}°`}</Text>
          <Text class="text-xs text-slate-500">Current</Text>
        </View>
        <View class={SURFACE_INSET}>
          <Text class="text-lg text-blue-400 font-bold">{`${state.value.humidity}%`}</Text>
          <Text class="text-xs text-slate-500">Humidity</Text>
        </View>
      </View>

      <Tabs value={state.value.mode} onValueChange={setMode}>
        <TabsList>
          <TabsTrigger value="heat" label="Heat" />
          <TabsTrigger value="cool" label="Cool" />
          <TabsTrigger value="auto" label="Auto" />
          <TabsTrigger value="off" label="Off" />
        </TabsList>
      </Tabs>
      <Text class="text-xs text-slate-500 text-center">{MODE_LABELS[state.value.mode]}</Text>
    </View>
  );
}
