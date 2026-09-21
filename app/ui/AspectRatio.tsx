import { View } from "@pocketjs/framework/components";
import type { UiChildren } from "./children.ts";

export interface AspectRatioProps {
  ratio?: number;
  width: number;
  children?: UiChildren;
}

export function AspectRatio(props: AspectRatioProps) {
  const ratio = props.ratio ?? 16 / 9;
  const height = Math.round(props.width / ratio);
  return (
    <View class="overflow-hidden rounded-xl bg-slate-800" style={{ width: props.width, height }}>
      {props.children}
    </View>
  );
}
