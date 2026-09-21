import { Focusable, View } from "@pocketjs/framework/components";
import { SWITCH_OFF, SWITCH_ON, SWITCH_THUMB } from "./tokens.ts";

export interface SwitchProps {
  checked: boolean;
  onPress: () => void;
}

export function Switch(props: SwitchProps) {
  return (
    <Focusable class={props.checked ? SWITCH_ON : SWITCH_OFF} onPress={props.onPress}>
      <View class={SWITCH_THUMB} />
    </Focusable>
  );
}
