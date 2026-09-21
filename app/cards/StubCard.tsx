import { Text, View } from "@pocketjs/framework/components";
import type { BaseCardConfig } from "../types/card.ts";

export interface StubCardProps {
  config: BaseCardConfig;
}

export default function StubCard(props: StubCardProps) {
  return (
    <View class="flex-col items-center justify-center flex-1 gap-1 p-2">
      <Text class="text-xs text-slate-500 font-bold">Unsupported card</Text>
      <Text class="text-xs text-slate-600">{props.config.type}</Text>
    </View>
  );
}
