import { View, Text } from "@pocketjs/framework/components";
import type { CalendarCardConfig } from "../types/card.ts";
import type { EntityState } from "../types/entity.ts";
import type { DataSource } from "../store/data-source.ts";

export interface CalendarCardProps {
  config: CalendarCardConfig;
  entities: EntityState;
  source: DataSource;
}

export default function CalendarCard(_props: CalendarCardProps) {
  const now = new Date();
  const month = now.toLocaleDateString("en", { month: "long", year: "numeric" });
  const day = now.getDate();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <View class="flex-col flex-1 p-3 gap-2">
      <Text class="text-sm text-slate-100 font-bold">{month}</Text>
      <View class="flex-row">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <View key={`dh-${i}`} class="flex-1 items-center">
            <Text class="text-xs text-slate-500">{d}</Text>
          </View>
        ))}
      </View>
      <View class="flex-row flex-wrap">
        {cells.map((d, i) => (
          <View
            key={`dc-${i}`}
            class="items-center justify-center"
            style={{ width: "14.28%", height: 20 }}
          >
            {d != null ? (
              <Text
                class={d === day ? "text-xs text-blue-400 font-bold" : "text-xs text-slate-300"}
              >
                {String(d)}
              </Text>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}
