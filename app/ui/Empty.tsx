import { Text, View } from "@pocketjs/framework/components";
import { EMPTY_SHELL } from "./tokens.ts";

export interface EmptyProps {
  title: string;
  description?: string;
}

export function Empty(props: EmptyProps) {
  return (
    <View class={EMPTY_SHELL}>
      <Text class="text-sm text-slate-300 font-bold">{props.title}</Text>
      {props.description ? (
        <Text class="text-xs text-slate-500 text-center">{props.description}</Text>
      ) : null}
    </View>
  );
}
