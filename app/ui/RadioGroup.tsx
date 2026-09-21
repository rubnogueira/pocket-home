import { provide, inject, type InjectionKey } from "vue";
import type { UiChildren } from "./children.ts";
import { Focusable, Text, View } from "@pocketjs/framework/components";
import { RADIO_ITEM_OFF, RADIO_ITEM_ON } from "./tokens.ts";

interface RadioContext {
  value: () => string;
  onSelect: (value: string) => void;
}

const RADIO_CTX: InjectionKey<RadioContext> = Symbol("pocket-home.radio");

export interface RadioGroupProps {
  value: string;
  onValueChange: (value: string) => void;
  children?: UiChildren;
}

export function RadioGroup(props: RadioGroupProps) {
  provide(RADIO_CTX, {
    value: () => props.value,
    onSelect: props.onValueChange,
  });
  return <View class="flex-col gap-1">{props.children}</View>;
}

export interface RadioItemProps {
  value: string;
  label: string;
}

export function RadioItem(props: RadioItemProps) {
  const ctx = inject(RADIO_CTX)!;
  const active = ctx.value() === props.value;
  return (
    <Focusable
      class={active ? RADIO_ITEM_ON : RADIO_ITEM_OFF}
      onPress={() => ctx.onSelect(props.value)}
    >
      <View
        class={
          active
            ? "w-4 h-4 rounded-full bg-blue-500 items-center justify-center"
            : "w-4 h-4 rounded-full bg-slate-700"
        }
      >
        {active ? <View class="w-2 h-2 rounded-full bg-white" /> : null}
      </View>
      <Text class={active ? "text-sm text-slate-100 font-bold" : "text-sm text-slate-400"}>
        {props.label}
      </Text>
    </Focusable>
  );
}
