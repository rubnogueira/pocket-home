import { Text, View } from "@pocketjs/framework/components";
import { BADGE_LABEL, BADGE_SHELL } from "./tokens.ts";

export type BadgeVariant = "default" | "success" | "warning" | "danger" | "muted";

export interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
}

export function Badge(props: BadgeProps) {
  const variant = props.variant ?? "default";
  return (
    <View class={BADGE_SHELL[variant]}>
      <Text class={BADGE_LABEL[variant]}>{props.label}</Text>
    </View>
  );
}
