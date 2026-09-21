import { Text, View } from "@pocketjs/framework/components";
import { CONFIG } from "../data/config.ts";
import { LOCATION_ROW } from "../ui/tokens.ts";

function formatCoord(value: number, pos: string, neg: string): string {
  const dir = value >= 0 ? pos : neg;
  const abs = Math.abs(value);
  const deg = Math.floor(abs);
  const min = Math.floor((abs - deg) * 60);
  const sec = Math.round(((abs - deg) * 60 - min) * 60);
  return `${deg}° ${min}' ${sec}" ${dir}`;
}

export default function LocationWidget() {
  const { city, country, latitude, longitude } = CONFIG.location;
  const lat = formatCoord(latitude, "N", "S");
  const lon = formatCoord(longitude, "E", "W");

  return (
    <View class="flex-col flex-1 justify-between">
      <View class="flex-col gap-1">
        <Text class="text-3xl text-slate-50 font-bold">{city}</Text>
        <Text class="text-lg text-slate-300">{country}</Text>
      </View>

      <View class="flex-col gap-2">
        <View class="flex-row items-center gap-2">
          <View class="w-2 h-2 rounded-full bg-emerald-500" />
          <Text class="text-sm text-slate-400">{lat}</Text>
        </View>
        <View class="flex-row items-center gap-2">
          <View class="w-2 h-2 rounded-full bg-blue-500" />
          <Text class="text-sm text-slate-400">{lon}</Text>
        </View>
      </View>

      <View class={LOCATION_ROW}>
        <Text class="text-xs text-slate-500">Timezone</Text>
        <Text class="text-sm text-slate-300">UTC+1</Text>
      </View>
    </View>
  );
}
