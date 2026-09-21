import { Text, View } from "@pocketjs/framework/components";
import { INPUT_PLACEHOLDER, INPUT_TEXT, TEXTAREA_SHELL } from "./tokens.ts";

export interface TextareaProps {
  value?: string;
  placeholder?: string;
  lines?: number;
}

export function Textarea(props: TextareaProps) {
  const hasValue = (props.value ?? "").length > 0;
  const minH = (props.lines ?? 3) * 24;
  return (
    <View class={TEXTAREA_SHELL} style={{ minHeight: minH }}>
      <Text class={hasValue ? INPUT_TEXT : INPUT_PLACEHOLDER}>
        {hasValue ? props.value : (props.placeholder ?? "Enter details")}
      </Text>
    </View>
  );
}
