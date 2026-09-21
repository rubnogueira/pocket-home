import { onMounted, onScopeDispose, ref } from "vue";
import { Text, View } from "@pocketjs/framework/components";
import { after } from "@pocketjs/framework/clock";
import { Progress, ToggleGroup } from "../ui/index.ts";
import { ENERGY_GRID, ENERGY_SOLAR } from "../ui/tokens.ts";

function randomDrift(base: number, range: number): number {
  return Math.round((base + (Math.random() - 0.5) * range) * 10) / 10;
}

export default function EnergyWidget() {
  const energy = ref({
    current: 2.4,
    today: 18.7,
    solar: 1.8,
    grid: 0.6,
  });
  const view = ref<"live" | "daily">("live");

  let cancel: (() => void) | undefined;

  function tick(): void {
    energy.value = {
      current: randomDrift(2.4, 1.2),
      today: energy.value.today + 0.01,
      solar: randomDrift(1.8, 0.8),
      grid: randomDrift(0.6, 0.4),
    };
  }

  function schedule(): void {
    cancel = after(5, () => {
      tick();
      schedule();
    });
  }

  onMounted(() => {
    schedule();
  });
  onScopeDispose(() => {
    if (cancel) cancel();
  });

  const solarPct = () => {
    const total = energy.value.solar + Math.abs(energy.value.grid);
    if (total === 0) return 0;
    return Math.round((energy.value.solar / total) * 100);
  };

  const headline = () => (view.value === "live" ? energy.value.current : energy.value.today);
  const unit = () => (view.value === "live" ? "kW now" : "kWh today");

  return (
    <View class="flex-col flex-1 gap-3">
      <ToggleGroup
        value={view.value}
        options={[
          { value: "live", label: "Live" },
          { value: "daily", label: "Daily" },
        ]}
        onValueChange={(v) => {
          view.value = v as "live" | "daily";
        }}
      />

      <View class="flex-col items-center gap-1">
        <Text class="text-4xl text-slate-50 font-bold">{String(headline())}</Text>
        <Text class="text-sm text-slate-400">{unit()}</Text>
      </View>

      <View class="flex-row gap-2">
        <View class={ENERGY_SOLAR}>
          <Text class="text-lg text-emerald-400 font-bold">{String(energy.value.solar)}</Text>
          <Text class="text-xs text-slate-500">Solar</Text>
        </View>
        <View class={ENERGY_GRID}>
          <Text class="text-lg text-blue-400 font-bold">{String(energy.value.grid)}</Text>
          <Text class="text-xs text-slate-500">Grid</Text>
        </View>
      </View>

      <Progress value={solarPct()} label="Solar share" showValue />
    </View>
  );
}
