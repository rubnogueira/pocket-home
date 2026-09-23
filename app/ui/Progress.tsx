import { Text, View } from "@pocketjs/framework/components";
import { PROGRESS_FILL, PROGRESS_TRACK } from "./tokens.ts";

export interface ProgressProps {
  value: number;
  max?: number;
  label?: string;
  showValue?: boolean;
}

export function Progress(props: ProgressProps) {
  const max = props.max ?? 100;
  const pct = max <= 0 ? 0 : Math.max(0, Math.min(100, Math.round((props.value / max) * 100)));
  return (
    <View class="flex-col gap-1 flex-1">
      {props.label || props.showValue ? (
        <View class="flex-row items-center justify-between">
          {props.label ? <Text class="text-xs text-slate-500">{props.label}</Text> : <View />}
          {props.showValue ? (
            <Text class="text-xs text-slate-400 font-bold">{`${pct}%`}</Text>
          ) : null}
        </View>
      ) : null}
      <View class={PROGRESS_TRACK}>
        {/* Split by flex grow: the core has no percentage widths. */}
        <View class={PROGRESS_FILL} style={{ grow: pct, basis: 0 }} />
        <View style={{ grow: 100 - pct, basis: 0 }} />
      </View>
    </View>
  );
}
