import { computed, onMounted, onScopeDispose, ref } from "vue";
import { Text, View } from "@pocketjs/framework/components";
import { after } from "@pocketjs/framework/clock";

const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function firstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

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

export default function CalendarWidget() {
  const now = new Date();
  const currentYear = ref(now.getFullYear());
  const currentMonth = ref(now.getMonth());
  const today = ref(now.getDate());

  const rows = computed(() => {
    const total = daysInMonth(currentYear.value, currentMonth.value);
    const offset = firstDayOfMonth(currentYear.value, currentMonth.value);

    const cells: (number | null)[] = [];
    for (let i = 0; i < offset; i++) cells.push(null);
    for (let d = 1; d <= total; d++) cells.push(d);
    // Pad the last row to 7 cells
    while (cells.length % 7 !== 0) cells.push(null);

    const result: (number | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      result.push(cells.slice(i, i + 7));
    }
    return result;
  });

  const monthName = computed(() => MONTHS[currentMonth.value]);

  let cancel: (() => void) | undefined;
  function schedule(): void {
    cancel = after(60, () => {
      const d = new Date();
      currentYear.value = d.getFullYear();
      currentMonth.value = d.getMonth();
      today.value = d.getDate();
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
    <View class="flex-col flex-1 gap-1">
      {/* Month + year header */}
      <View class="flex-row items-center justify-between pb-1">
        <Text class="text-lg text-slate-50 font-bold">{monthName.value}</Text>
        <Text class="text-sm text-slate-500">{String(currentYear.value)}</Text>
      </View>

      {/* Day-of-week header */}
      <View class="flex-row">
        {DAY_LABELS.map((label) => (
          <View class="flex-1 items-center justify-center py-1" key={label}>
            <Text class="text-xs text-slate-500 font-bold">{label}</Text>
          </View>
        ))}
      </View>

      {/* Calendar grid */}
      {rows.value.map((row, ri) => (
        <View class="flex-row" key={`row-${ri}`}>
          {row.map((day, ci) => (
            <View
              class={
                day === today.value
                  ? "flex-1 items-center justify-center rounded-lg bg-blue-500"
                  : "flex-1 items-center justify-center"
              }
              style={{ height: 22 }}
              key={`cell-${ri}-${ci}`}
            >
              <Text
                class={
                  day === null
                    ? "text-xs text-slate-700"
                    : day === today.value
                      ? "text-xs text-white font-bold"
                      : "text-xs text-slate-300"
                }
              >
                {day !== null ? String(day) : ""}
              </Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}
