import { Text, View } from "@pocketjs/framework/components";

export interface BreadcrumbItem {
  label: string;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export function Breadcrumb(props: BreadcrumbProps) {
  return (
    <View class="flex-row items-center flex-wrap gap-1">
      {props.items.map((item, i) => (
        <View key={i} class="flex-row items-center gap-1">
          {i > 0 ? <Text class="text-xs text-slate-600">/</Text> : null}
          <Text
            class={
              i === props.items.length - 1
                ? "text-xs text-slate-200 font-bold"
                : "text-xs text-slate-500"
            }
          >
            {item.label}
          </Text>
        </View>
      ))}
    </View>
  );
}
