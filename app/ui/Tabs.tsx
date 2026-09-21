import { provide, inject, type InjectionKey } from "vue";
import type { UiChildren } from "./children.ts";
import { Focusable, Text, View } from "@pocketjs/framework/components";
import {
  TAB_LABEL_ACTIVE,
  TAB_LABEL_INACTIVE,
  TAB_TRIGGER_ACTIVE,
  TAB_TRIGGER_INACTIVE,
  TABS_CONTENT,
  TABS_LIST,
  TABS_ROOT,
} from "./tokens.ts";

export interface TabsContext {
  value: () => string;
  onSelect: (value: string) => void;
}

const TABS_CTX: InjectionKey<TabsContext> = Symbol("pocket-home.tabs");

function useTabsContext(): TabsContext {
  const ctx = inject(TABS_CTX, null);
  if (!ctx) {
    throw new Error("TabsList, TabsTrigger, and TabsContent must be used inside Tabs");
  }
  return ctx;
}

export interface TabsProps {
  value: string;
  onValueChange: (value: string) => void;
  children?: UiChildren;
}

export function Tabs(props: TabsProps) {
  provide(TABS_CTX, {
    value: () => props.value,
    onSelect: props.onValueChange,
  });
  return <View class={TABS_ROOT}>{props.children}</View>;
}

export interface TabsListProps {
  children?: UiChildren;
}

export function TabsList(props: TabsListProps) {
  useTabsContext();
  return <View class={TABS_LIST}>{props.children}</View>;
}

export interface TabsTriggerProps {
  value: string;
  label: string;
}

export function TabsTrigger(props: TabsTriggerProps) {
  const ctx = useTabsContext();
  const active = ctx.value() === props.value;
  return (
    <Focusable
      class={active ? TAB_TRIGGER_ACTIVE : TAB_TRIGGER_INACTIVE}
      onPress={() => ctx.onSelect(props.value)}
    >
      <Text class={active ? TAB_LABEL_ACTIVE : TAB_LABEL_INACTIVE}>{props.label}</Text>
    </Focusable>
  );
}

export interface TabsContentProps {
  value: string;
  children?: UiChildren;
}

export function TabsContent(props: TabsContentProps) {
  const ctx = useTabsContext();
  const active = ctx.value() === props.value;
  return (
    <View class={TABS_CONTENT} style={active ? undefined : { height: 0, opacity: 0 }}>
      {active ? props.children : null}
    </View>
  );
}
