import { Text, View } from "@pocketjs/framework/components";
import { INPUT_PLACEHOLDER, INPUT_SHELL, INPUT_TEXT } from "./tokens.ts";

export interface InputProps {
  value?: string;
  placeholder?: string;
}

export function Input(props: InputProps) {
  const hasValue = (props.value ?? "").length > 0;
  return (
    <View class={INPUT_SHELL}>
      <Text class={hasValue ? INPUT_TEXT : INPUT_PLACEHOLDER}>
        {hasValue ? props.value : (props.placeholder ?? "Enter text")}
      </Text>
    </View>
  );
}
