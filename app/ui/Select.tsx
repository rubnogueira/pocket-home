import { Focusable, Text } from "@pocketjs/framework/components";
import { SELECT_ROW } from "./tokens.ts";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  value: string;
  options: SelectOption[];
  onValueChange: (value: string) => void;
  label?: string;
}

export function Select(props: SelectProps) {
  const current = props.options.find((o) => o.value === props.value);

  function cycle(): void {
    const idx = props.options.findIndex((o) => o.value === props.value);
    const next = props.options[(idx + 1) % props.options.length];
    props.onValueChange(next.value);
  }

  return (
    <Focusable class={SELECT_ROW} onPress={cycle}>
      <Text class="text-sm text-slate-300">{props.label ?? "Select"}</Text>
      <Text class="text-sm text-blue-400 font-bold">{current?.label ?? props.value}</Text>
    </Focusable>
  );
}
