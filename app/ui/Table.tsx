import { Text, View } from "@pocketjs/framework/components";
import type { UiChildren } from "./children.ts";
import { TABLE_CELL, TABLE_HEADER_CELL, TABLE_ROW } from "./tokens.ts";

export interface TableProps {
  children?: UiChildren;
}

export function Table(props: TableProps) {
  return <View class="flex-col w-full">{props.children}</View>;
}

export function TableHeader(props: { children?: UiChildren }) {
  return <View class="flex-col">{props.children}</View>;
}

export function TableBody(props: { children?: UiChildren }) {
  return <View class="flex-col gap-1">{props.children}</View>;
}

export function TableRow(props: { children?: UiChildren }) {
  return <View class={TABLE_ROW}>{props.children}</View>;
}

export function TableHead(props: { children?: UiChildren; flex?: number }) {
  return (
    <View class="flex-1" style={{ flex: props.flex ?? 1 }}>
      <Text class={TABLE_HEADER_CELL}>{props.children}</Text>
    </View>
  );
}

export function TableCell(props: { children?: UiChildren; flex?: number }) {
  return (
    <View class="flex-1" style={{ flex: props.flex ?? 1 }}>
      <Text class={TABLE_CELL}>{props.children}</Text>
    </View>
  );
}
