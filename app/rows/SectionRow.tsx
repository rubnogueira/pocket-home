import { View, Text } from "@pocketjs/framework/components";
import type { SectionRowConfig } from "../types/row.ts";
import type { RowRenderProps } from "../types/pocket-component.ts";

export interface SectionRowProps extends RowRenderProps {
  config: SectionRowConfig;
}

export default function SectionRow(props: SectionRowProps) {
  return (
    <View class="px-3 py-2">
      <Text class="text-xs text-slate-500 font-bold">{props.config.label ?? ""}</Text>
    </View>
  );
}
