import { Focusable, Text, View } from "@pocketjs/framework/components";
import {
  LIST_ROW_ACTIVE,
  LIST_ROW_ACTIVE_STATIC,
  LIST_ROW_INACTIVE,
  LIST_ROW_INACTIVE_STATIC,
} from "./tokens.ts";

export interface ListItemProps {
  title: string;
  subtitle?: string;
  onPress?: () => void;
  /** Leading dot color when `on` is true vs false. */
  on?: boolean;
}

export function ListItem(props: ListItemProps) {
  const shellInteractive = props.on ? LIST_ROW_ACTIVE : LIST_ROW_INACTIVE;
  const shellStatic = props.on ? LIST_ROW_ACTIVE_STATIC : LIST_ROW_INACTIVE_STATIC;

  const dot = props.on ? "w-3 h-3 rounded-full bg-amber-400" : "w-3 h-3 rounded-full bg-slate-600";

  const titleClass = props.on ? "text-sm text-slate-200 font-bold" : "text-sm text-slate-400";

  const body = (
    <>
      <View class={dot} />
      <View class="flex-col flex-1">
        <Text class={titleClass}>{props.title}</Text>
        {props.subtitle ? <Text class="text-xs text-slate-500">{props.subtitle}</Text> : null}
      </View>
    </>
  );

  if (props.onPress) {
    return (
      <Focusable class={shellInteractive} onPress={props.onPress}>
        {body}
      </Focusable>
    );
  }

  return <View class={shellStatic}>{body}</View>;
}
