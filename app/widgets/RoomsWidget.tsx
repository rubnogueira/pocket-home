import { ref } from "vue";
import { Text, View, Focusable } from "@pocketjs/framework/components";
import { Avatar, Badge } from "../ui/index.ts";
import { CHIP_ACTIVE_AMBER, CHIP_INACTIVE, ROW_ACTIVE_AMBER, ROW_INACTIVE } from "../ui/tokens.ts";

interface Room {
  id: string;
  name: string;
  devices: number;
  activeDevices: number;
  temp: number;
}

const INITIAL_ROOMS: Room[] = [
  { id: "r1", name: "Living", devices: 5, activeDevices: 3, temp: 22 },
  { id: "r2", name: "Kitchen", devices: 4, activeDevices: 2, temp: 23 },
  { id: "r3", name: "Bedroom", devices: 3, activeDevices: 0, temp: 20 },
  { id: "r4", name: "Office", devices: 4, activeDevices: 2, temp: 21 },
  { id: "r5", name: "Bath", devices: 2, activeDevices: 0, temp: 24 },
  { id: "r6", name: "Garden", devices: 3, activeDevices: 1, temp: 18 },
];

export default function RoomsWidget() {
  const rooms = ref<Room[]>(INITIAL_ROOMS.map((r) => ({ ...r })));

  function toggleRoom(id: string): void {
    const idx = rooms.value.findIndex((r) => r.id === id);
    if (idx < 0) return;
    const room = rooms.value[idx];
    if (room.activeDevices > 0) {
      rooms.value[idx] = { ...room, activeDevices: 0 };
    } else {
      rooms.value[idx] = { ...room, activeDevices: room.devices };
    }
    rooms.value = [...rooms.value];
  }

  return (
    <View class="flex-col flex-1 gap-1">
      <View class="flex-row items-center justify-end pb-1">
        <Badge label={`${rooms.value.length} rooms`} variant="muted" />
      </View>

      <View class="flex-col gap-1 flex-1">
        {rooms.value.map((room) => {
          const isOn = room.activeDevices > 0;
          return (
            <Focusable
              key={room.id}
              class={isOn ? ROW_ACTIVE_AMBER : ROW_INACTIVE}
              onPress={() => toggleRoom(room.id)}
            >
              <View class="flex-row items-center gap-2 flex-1">
                <Avatar label={room.name} />
                <Text class={isOn ? "text-sm text-slate-100 font-bold" : "text-sm text-slate-400"}>
                  {room.name}
                </Text>
              </View>
              <View class="flex-row items-center gap-2">
                <Text class="text-xs text-slate-500">{`${room.temp}°`}</Text>
                <View class={isOn ? CHIP_ACTIVE_AMBER : CHIP_INACTIVE}>
                  <Text
                    class={isOn ? "text-xs text-amber-400 font-bold" : "text-xs text-slate-500"}
                  >
                    {isOn ? `${room.activeDevices}/${room.devices}` : "Off"}
                  </Text>
                </View>
              </View>
            </Focusable>
          );
        })}
      </View>
    </View>
  );
}
