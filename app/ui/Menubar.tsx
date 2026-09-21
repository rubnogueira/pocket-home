import { View } from "@pocketjs/framework/components";
import { Button } from "./Button.tsx";

export interface MenubarItem {
  id: string;
  label: string;
}

export interface MenubarProps {
  items: MenubarItem[];
  activeId?: string;
  onSelect: (id: string) => void;
}

export function Menubar(props: MenubarProps) {
  return (
    <View class="flex-row flex-wrap gap-1 p-1 rounded-xl bg-slate-950">
      {props.items.map((item) => (
        <Button
          key={item.id}
          label={item.label}
          variant="secondary"
          size="sm"
          active={props.activeId === item.id}
          onPress={() => props.onSelect(item.id)}
        />
      ))}
    </View>
  );
}
