import { Text, View } from "@pocketjs/framework/components";
import type { UiChildren } from "./children.ts";
import { SURFACE_CARD } from "./tokens.ts";

export interface HoverCardProps {
  title: string;
  description?: string;
  children?: UiChildren;
}

/** No pointer hover on device — card content is always shown beneath the trigger slot. */
export function HoverCard(props: HoverCardProps) {
  return (
    <View class="flex-col gap-2">
      {props.children}
      <View class={SURFACE_CARD}>
        <View class="px-3 py-3 flex-col gap-1">
          <Text class="text-sm text-slate-100 font-bold">{props.title}</Text>
          {props.description ? (
            <Text class="text-xs text-slate-400">{props.description}</Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}
