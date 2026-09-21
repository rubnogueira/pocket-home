import { View } from "@pocketjs/framework/components";
import type { UiChildren } from "./children.ts";
import { SCROLL_AREA } from "./tokens.ts";

export interface ScrollAreaProps {
  children?: UiChildren;
}

/** Clips children; pair with an outer kinetic scroller for long lists. */
export function ScrollArea(props: ScrollAreaProps) {
  return <View class={SCROLL_AREA}>{props.children}</View>;
}
