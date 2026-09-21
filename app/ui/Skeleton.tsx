import { View } from "@pocketjs/framework/components";
import { SKELETON } from "./tokens.ts";

export interface SkeletonProps {
  width?: number;
  height?: number;
}

export function Skeleton(props: SkeletonProps) {
  return (
    <View
      class={SKELETON}
      style={{
        width: props.width ?? 120,
        height: props.height ?? 16,
      }}
    />
  );
}
