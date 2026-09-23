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
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

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
      {/* One row per week of 7 flex-1 cells (the core has no percentage widths). */}
      {weeks.map((week, w) => (
        <View key={`dw-${w}`} class="flex-row">
          {week.map((d, i) => (
            <View
              key={`dc-${w}-${i}`}
              class="flex-1 items-center justify-center"
              style={{ height: 20 }}
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
      ))}
    </View>
  );
}
