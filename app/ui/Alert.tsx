import { Text, View } from "@pocketjs/framework/components";
import { ALERT_DESC, ALERT_SHELL, ALERT_TITLE } from "./tokens.ts";

export type AlertVariant = "default" | "success" | "warning" | "destructive";

export interface AlertProps {
  title: string;
  description?: string;
  variant?: AlertVariant;
}

export function Alert(props: AlertProps) {
  const variant = props.variant ?? "default";
  return (
    <View class={ALERT_SHELL[variant]}>
      <Text class={ALERT_TITLE[variant]}>{props.title}</Text>
      {props.description ? <Text class={ALERT_DESC}>{props.description}</Text> : null}
    </View>
  );
}
