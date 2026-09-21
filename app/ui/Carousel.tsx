import { ref, type Ref } from "vue";
import { Text, View } from "@pocketjs/framework/components";
import { Button } from "./Button.tsx";
import type { UiChildren } from "./children.ts";

export interface CarouselProps<T = unknown> {
  items: T[];
  renderItem: (item: T, index: number) => UiChildren;
}

export function Carousel(props: CarouselProps) {
  const index: Ref<number> = ref(0);
  const count = props.items.length;
  const item = () => props.items[index.value];

  function prev(): void {
    index.value = (index.value - 1 + count) % count;
  }
  function next(): void {
    index.value = (index.value + 1) % count;
  }

  if (count === 0) return null;

  return (
    <View class="flex-col gap-2 flex-1">
      <View class="flex-1">{props.renderItem(item(), index.value)}</View>
      <View class="flex-row items-center justify-between">
        <Button label="Prev" variant="outline" size="sm" onPress={prev} />
        <Text class="text-xs text-slate-500">{`${index.value + 1} / ${count}`}</Text>
        <Button label="Next" variant="outline" size="sm" onPress={next} />
      </View>
    </View>
  );
}
