import { View } from "@pocketjs/framework/components";
import type { UiChildren } from "./children.ts";
import { Label } from "./Label.tsx";
import { SURFACE_FIELD } from "./tokens.ts";

export interface FormFieldProps {
  label: string;
  horizontal?: boolean;
  children?: UiChildren;
}

export function FormField(props: FormFieldProps) {
  if (props.horizontal) {
    return (
      <View class={SURFACE_FIELD}>
        <Label>{props.label}</Label>
        {props.children}
      </View>
    );
  }
  return (
    <View class="flex-col gap-1">
      <Label>{props.label}</Label>
      {props.children}
    </View>
  );
}
