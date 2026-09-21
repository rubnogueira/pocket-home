import { Focusable, Text } from "@pocketjs/framework/components";
import { TOGGLE_OFF, TOGGLE_ON } from "./tokens.ts";

export interface ToggleProps {
  key?: string | number;
  label: string;
  pressed: boolean;
  onPress: () => void;
}

export function Toggle(props: ToggleProps) {
  return (
    <Focusable class={props.pressed ? TOGGLE_ON : TOGGLE_OFF} onPress={props.onPress}>
      <Text class={props.pressed ? "text-xs text-slate-100 font-bold" : "text-xs text-slate-400"}>
        {props.label}
      </Text>
    </Focusable>
  );
}
