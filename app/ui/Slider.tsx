import { Focusable, Text, View } from "@pocketjs/framework/components";
import { PROGRESS_FILL, PROGRESS_TRACK } from "./tokens.ts";

export interface SliderProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onValueChange: (value: number) => void;
  label?: string;
}

export function Slider(props: SliderProps) {
  const min = props.min ?? 0;
  const max = props.max ?? 100;
  const step = props.step ?? 1;
  const span = max - min;
  const pct = span <= 0 ? 0 : Math.round(((props.value - min) / span) * 100);

  function nudge(delta: number): void {
    const next = Math.max(min, Math.min(max, props.value + delta * step));
    props.onValueChange(next);
  }

  return (
    <View class="flex-col gap-1">
      {props.label ? (
        <View class="flex-row items-center justify-between">
          <Text class="text-xs text-slate-500">{props.label}</Text>
          <Text class="text-xs text-slate-300 font-bold">{String(props.value)}</Text>
        </View>
      ) : null}
      <View class="flex-row items-center gap-2">
        <Focusable
          class="w-8 h-8 rounded-lg bg-slate-700 items-center justify-center focus:bg-slate-600 active:bg-slate-500"
          onPress={() => nudge(-1)}
        >
          <Text class="text-sm text-slate-200 font-bold">-</Text>
        </Focusable>
        <View class={PROGRESS_TRACK}>
          <View class={PROGRESS_FILL} style={{ width: `${pct}%` }} />
        </View>
        <Focusable
          class="w-8 h-8 rounded-lg bg-slate-700 items-center justify-center focus:bg-slate-600 active:bg-slate-500"
          onPress={() => nudge(1)}
        >
          <Text class="text-sm text-slate-200 font-bold">+</Text>
        </Focusable>
      </View>
    </View>
  );
}
