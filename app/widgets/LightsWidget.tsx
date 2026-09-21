import { ref } from "vue";
import { View } from "@pocketjs/framework/components";
import { Badge, Button } from "../ui/index.ts";
import { DeviceRow } from "./ui.tsx";

interface LightDevice {
  id: string;
  name: string;
  on: boolean;
  brightness: number;
}

const INITIAL_LIGHTS: LightDevice[] = [
  { id: "l1", name: "Living Room", on: true, brightness: 80 },
  { id: "l2", name: "Kitchen", on: true, brightness: 100 },
  { id: "l3", name: "Bedroom", on: false, brightness: 0 },
  { id: "l4", name: "Bathroom", on: false, brightness: 0 },
  { id: "l5", name: "Office", on: true, brightness: 60 },
  { id: "l6", name: "Hallway", on: false, brightness: 0 },
  { id: "l7", name: "Porch", on: true, brightness: 40 },
];

export default function LightsWidget() {
  const lights = ref<LightDevice[]>(INITIAL_LIGHTS);

  function toggle(id: string): void {
    lights.value = lights.value.map((l) =>
      l.id === id ? { ...l, on: !l.on, brightness: l.on ? 0 : 80 } : l,
    );
  }

  function allOff(): void {
    lights.value = lights.value.map((l) => ({ ...l, on: false, brightness: 0 }));
  }

  function allOn(): void {
    lights.value = lights.value.map((l) => ({ ...l, on: true, brightness: 80 }));
  }

  const onCount = () => lights.value.filter((l) => l.on).length;

  return (
    <View class="flex-col flex-1 gap-2">
      <View class="flex-row items-center justify-between">
        <Badge label={`${onCount()} on`} variant="warning" />
        <View class="flex-row gap-2">
          <Button label="All On" variant="secondary" size="sm" onPress={allOn} />
          <Button label="All Off" variant="outline" size="sm" onPress={allOff} />
        </View>
      </View>

      <View class="flex-col gap-1 flex-1">
        {lights.value.map((light) => (
          <DeviceRow
            key={light.id}
            name={light.name}
            status={light.on ? `${light.brightness}%` : "Off"}
            on={light.on}
            onPress={() => toggle(light.id)}
          />
        ))}
      </View>
    </View>
  );
}
