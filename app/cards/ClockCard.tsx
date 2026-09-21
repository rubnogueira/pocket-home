import { ref, onMounted, onScopeDispose } from "vue";
import { View, Text } from "@pocketjs/framework/components";
import { after } from "@pocketjs/framework/clock";
import type { ClockCardConfig } from "../types/card.ts";
import type { EntityState } from "../types/entity.ts";
import type { DataSource } from "../store/data-source.ts";

export interface ClockCardProps {
  config: ClockCardConfig;
  entities: EntityState;
  source: DataSource;
}

function pad2(n: number): string {
  return n < 10 ? "0" + n : String(n);
}

export default function ClockCard(props: ClockCardProps) {
  const is24h = (props.config.display ?? "24h") === "24h";
  const d = new Date();
  const timeStr = ref(formatTime(d, is24h));
  const dateStr = ref(
    d.toLocaleDateString("en", { weekday: "long", month: "long", day: "numeric" }),
  );

  let cancel: (() => void) | undefined;
  function tick() {
    const now = new Date();
    timeStr.value = formatTime(now, is24h);
    dateStr.value = now.toLocaleDateString("en", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  }
  function schedule() {
    cancel = after(30, () => {
      tick();
      schedule();
    });
  }
  onMounted(() => schedule());
  onScopeDispose(() => {
    if (cancel) cancel();
  });

  return (
    <View class="flex-col flex-1 items-center justify-center p-3">
      <Text class="text-4xl text-slate-50 font-bold">{timeStr.value}</Text>
      <Text class="text-xs text-slate-400">{dateStr.value}</Text>
    </View>
  );
}

function formatTime(d: Date, is24h: boolean): string {
  if (is24h) return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  const h = d.getHours() % 12 || 12;
  const ampm = d.getHours() >= 12 ? "PM" : "AM";
  return `${h}:${pad2(d.getMinutes())} ${ampm}`;
}
