import { ref } from "vue";
import { Focusable, Text, View } from "@pocketjs/framework/components";
import { ACCORDION_SECTION, ACCORDION_TRIGGER } from "./tokens.ts";
import type { UiChildren } from "./children.ts";

export interface AccordionItem {
  id: string;
  title: string;
  content: UiChildren;
}

export interface AccordionProps {
  items: AccordionItem[];
  defaultOpenId?: string;
}

export function Accordion(props: AccordionProps) {
  const openId = ref(props.defaultOpenId ?? props.items[0]?.id ?? "");
  return (
    <View class="flex-col gap-1">
      {props.items.map((item) => {
        const open = openId.value === item.id;
        return (
          <View key={item.id} class={ACCORDION_SECTION}>
            <Focusable
              class={ACCORDION_TRIGGER}
              onPress={() => {
                openId.value = open ? "" : item.id;
              }}
            >
              <Text class="text-sm text-slate-200 font-bold">{item.title}</Text>
              <Text class="text-xs text-slate-500">{open ? "-" : "+"}</Text>
            </Focusable>
            {open ? <View class="px-3 pb-3">{item.content}</View> : null}
          </View>
        );
      })}
    </View>
  );
}
