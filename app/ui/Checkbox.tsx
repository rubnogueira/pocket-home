import { Focusable, Text, View } from "@pocketjs/framework/components";
import { CHECKBOX_OFF, CHECKBOX_ON, CHECKBOX_ROW } from "./tokens.ts";

export interface CheckboxProps {
  checked: boolean;
  label?: string;
  onPress: () => void;
}

export function Checkbox(props: CheckboxProps) {
  return (
    <Focusable class={CHECKBOX_ROW} onPress={props.onPress}>
      <View class={props.checked ? CHECKBOX_ON : CHECKBOX_OFF}>
        {props.checked ? <Text class="text-xs text-white font-bold">x</Text> : null}
      </View>
      {props.label ? <Text class="text-sm text-slate-300 flex-1">{props.label}</Text> : null}
    </Focusable>
  );
}
