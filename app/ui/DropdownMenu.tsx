import { ref } from "vue";
import { Focusable, Text, View } from "@pocketjs/framework/components";

export interface DropdownMenuItem {
  id: string;
  label: string;
}

export interface DropdownMenuProps {
  label: string;
  items: DropdownMenuItem[];
  onSelect: (id: string) => void;
}

export function DropdownMenu(props: DropdownMenuProps) {
  const open = ref(false);
  return (
    <View class="flex-col gap-1">
      <Focusable
        class="flex-row items-center justify-between px-3 py-2 rounded-xl bg-slate-800 border-slate-600 focus:bg-slate-700 active:bg-slate-600"
        onPress={() => {
          open.value = !open.value;
        }}
      >
        <Text class="text-sm text-slate-200 font-bold">{props.label}</Text>
        <Text class="text-xs text-slate-500">{open.value ? "^" : "v"}</Text>
      </Focusable>
      {open.value ? (
        <View class="flex-col gap-1 px-1 py-1 rounded-xl bg-slate-900 border-slate-700">
          {props.items.map((item) => (
            <Focusable
              key={item.id}
              class="px-3 py-2 rounded-lg focus:bg-slate-800 active:bg-slate-700"
              onPress={() => {
                props.onSelect(item.id);
                open.value = false;
              }}
            >
              <Text class="text-sm text-slate-300">{item.label}</Text>
            </Focusable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
