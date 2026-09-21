import { onMounted, onScopeDispose, ref } from "vue";
import { Text, View } from "@pocketjs/framework/components";
import { after } from "@pocketjs/framework/clock";
import { CONFIG } from "../data/config.ts";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function formatTime(date: Date): string {
  const h = date.getHours();
  const m = date.getMinutes();
  const s = date.getSeconds();
  const pad = (n: number) => (n < 10 ? "0" + n : String(n));

  if (CONFIG.dashboard.use24Hour) {
    return CONFIG.dashboard.showSeconds ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(h)}:${pad(m)}`;
  }
  const h12 = h % 12 || 12;
  const ampm = h < 12 ? "AM" : "PM";
  return CONFIG.dashboard.showSeconds
    ? `${h12}:${pad(m)}:${pad(s)} ${ampm}`
    : `${h12}:${pad(m)} ${ampm}`;
}

function formatDate(date: Date): string {
  return `${DAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

export default function ClockWidget() {
  const now = new Date();
  const time = ref(formatTime(now));
  const date = ref(formatDate(now));
  const year = ref(String(now.getFullYear()));

  function tick(): void {
    const d = new Date();
    time.value = formatTime(d);
    date.value = formatDate(d);
    year.value = String(d.getFullYear());
  }

  let cancel: (() => void) | undefined;

  function schedule(): void {
    cancel = after(1, () => {
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

  return (
    <View class="flex-col flex-1 justify-center items-center gap-1">
      <Text class="text-4xl text-slate-50 font-bold tracking-wide">{time.value}</Text>
      <Text class="text-sm text-slate-300">{date.value}</Text>
      <Text class="text-xs text-slate-500">{year.value}</Text>
    </View>
  );
}
