import { ref } from "vue";
import { Text, View, Focusable } from "@pocketjs/framework/components";
import { Alert, Button } from "../ui/index.ts";
import { ROW_ACTIVE_EMERALD, ROW_ACTIVE_RED, ROW_LOCKED, ROW_UNLOCKED } from "../ui/tokens.ts";
import { StatusBadge } from "./ui.tsx";

interface DoorSensor {
  id: string;
  name: string;
  locked: boolean;
}

const INITIAL_DOORS: DoorSensor[] = [
  { id: "d1", name: "Front Door", locked: true },
  { id: "d2", name: "Back Door", locked: true },
  { id: "d3", name: "Garage", locked: false },
  { id: "d4", name: "Side Gate", locked: true },
];

export default function SecurityWidget() {
  const doors = ref<DoorSensor[]>(INITIAL_DOORS);
  const armed = ref(true);

  function toggleLock(id: string): void {
    doors.value = doors.value.map((d) => (d.id === id ? { ...d, locked: !d.locked } : d));
  }

  function toggleArmed(): void {
    armed.value = !armed.value;
  }

  function lockAll(): void {
    doors.value = doors.value.map((d) => ({ ...d, locked: true }));
  }

  const unlockedCount = () => doors.value.filter((d) => !d.locked).length;

  return (
    <View class="flex-col flex-1 gap-2">
      {unlockedCount() > 0 ? (
        <Alert
          variant="warning"
          title={`${unlockedCount()} door(s) unlocked`}
          description="Tap a door to lock it or use Lock All."
        />
      ) : null}
      <Focusable class={armed.value ? ROW_ACTIVE_EMERALD : ROW_ACTIVE_RED} onPress={toggleArmed}>
        <View class="flex-row items-center gap-2">
          <View
            class={
              armed.value
                ? "w-3 h-3 rounded-full bg-emerald-400"
                : "w-3 h-3 rounded-full bg-red-400"
            }
          />
          <Text
            class={
              armed.value ? "text-sm text-emerald-400 font-bold" : "text-sm text-red-400 font-bold"
            }
          >
            {armed.value ? "Armed" : "Disarmed"}
          </Text>
        </View>
        <StatusBadge label={armed.value ? "Secure" : "Tap to arm"} status={armed.value ? 0 : 2} />
      </Focusable>

      {/* Header + actions */}
      <View class="flex-row items-center justify-between">
        <Text class="text-sm text-slate-300 font-bold">Doors</Text>
        <View class="flex-row gap-2 items-center">
          {unlockedCount() > 0 ? (
            <StatusBadge label={`${unlockedCount()} unlocked`} status={1} />
          ) : (
            <StatusBadge label="All locked" status={0} />
          )}
          <Button label="Lock All" variant="outline" size="sm" onPress={lockAll} />
        </View>
      </View>

      {/* Door list */}
      <View class="flex-col gap-1 flex-1">
        {doors.value.map((door) => (
          <Focusable
            key={door.id}
            class={door.locked ? ROW_LOCKED : ROW_UNLOCKED}
            onPress={() => toggleLock(door.id)}
          >
            <View class="flex-row items-center gap-2">
              <View
                class={
                  door.locked
                    ? "w-3 h-3 rounded-full bg-emerald-500"
                    : "w-3 h-3 rounded-full bg-amber-400"
                }
              />
              <Text
                class={door.locked ? "text-sm text-slate-300" : "text-sm text-amber-300 font-bold"}
              >
                {door.name}
              </Text>
            </View>
            <Text
              class={
                door.locked
                  ? "text-xs text-emerald-500 font-bold"
                  : "text-xs text-amber-400 font-bold"
              }
            >
              {door.locked ? "Locked" : "Unlocked"}
            </Text>
          </Focusable>
        ))}
      </View>
    </View>
  );
}
