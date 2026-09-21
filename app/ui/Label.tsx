import { Text } from "@pocketjs/framework/components";
import type { UiChildren } from "./children.ts";
import { LABEL_TEXT } from "./tokens.ts";

export interface LabelProps {
  children?: UiChildren;
}

export function Label(props: LabelProps) {
  return <Text class={LABEL_TEXT}>{props.children}</Text>;
}
