import { ref } from "vue";
import type { UiChildren } from "./children.ts";
import { Focusable, Text, View } from "@pocketjs/framework/components";
import { ACCORDION_TRIGGER, COLLAPSIBLE_SHELL } from "./tokens.ts";

export interface CollapsibleProps {
  title: string;
  defaultOpen?: boolean;
  children?: UiChildren;
}

export function Collapsible(props: CollapsibleProps) {
  const open = ref(props.defaultOpen ?? false);
  return (
    <View class={COLLAPSIBLE_SHELL}>
      <Focusable
        class={ACCORDION_TRIGGER}
        onPress={() => {
          open.value = !open.value;
        }}
      >
        <Text class="text-sm text-slate-200 font-bold">{props.title}</Text>
        <Text class="text-xs text-slate-500">{open.value ? "-" : "+"}</Text>
      </Focusable>
      {open.value ? <View class="px-3 pb-3 flex-col gap-2">{props.children}</View> : null}
    </View>
  );
}
