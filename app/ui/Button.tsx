import { Focusable, Text } from "@pocketjs/framework/components";
import { BUTTON_LABEL, BUTTON_SHELL } from "./tokens.ts";

export type ButtonVariant = "default" | "secondary" | "ghost" | "destructive" | "outline";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps {
  key?: string | number;
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Selected / toggled look (secondary variant only). */
  active?: boolean;
}

function shellClass(variant: ButtonVariant, size: ButtonSize, active: boolean): string {
  if (variant === "secondary") {
    return active ? BUTTON_SHELL.secondary[size].on : BUTTON_SHELL.secondary[size].off;
  }
  return BUTTON_SHELL[variant][size];
}

function labelClass(variant: ButtonVariant, size: ButtonSize, active: boolean): string {
  if (variant === "secondary") {
    return active ? BUTTON_LABEL.secondary[size].on : BUTTON_LABEL.secondary[size].off;
  }
  return BUTTON_LABEL[variant][size];
}

export function Button(props: ButtonProps) {
  const variant = props.variant ?? "secondary";
  const size = props.size ?? "sm";
  const active = props.active ?? false;

  return (
    <Focusable class={shellClass(variant, size, active)} onPress={props.onPress}>
      <Text class={labelClass(variant, size, active)}>{props.label}</Text>
    </Focusable>
  );
}
