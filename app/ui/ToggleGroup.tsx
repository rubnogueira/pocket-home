import { View } from "@pocketjs/framework/components";
import { Toggle } from "./Toggle.tsx";

export interface ToggleGroupOption {
  value: string;
  label: string;
}

export interface ToggleGroupProps {
  value: string;
  options: ToggleGroupOption[];
  onValueChange: (value: string) => void;
}

export function ToggleGroup(props: ToggleGroupProps) {
  return (
    <View class="flex-row flex-wrap gap-1">
      {props.options.map((opt) => (
        <Toggle
          key={opt.value}
          label={opt.label}
          pressed={props.value === opt.value}
          onPress={() => props.onValueChange(opt.value)}
        />
      ))}
    </View>
  );
}
