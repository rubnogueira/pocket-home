import { Text, View } from "@pocketjs/framework/components";
import type { UiChildren } from "./children.ts";
import { TOOLTIP_BOX, TOOLTIP_TEXT } from "./tokens.ts";

export interface TooltipProps {
  label: string;
  hint: string;
  children?: UiChildren;
}

/** PocketJS has no hover — hint is always visible under the label (focus-first UX). */
export function Tooltip(props: TooltipProps) {
  return (
    <View class="flex-col gap-1">
      {props.children}
      <View class={TOOLTIP_BOX}>
        <Text class={TOOLTIP_TEXT}>{props.hint}</Text>
      </View>
    </View>
  );
}
