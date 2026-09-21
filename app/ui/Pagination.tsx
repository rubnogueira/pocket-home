import { Text, View } from "@pocketjs/framework/components";
import { Button } from "./Button.tsx";

export interface PaginationProps {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}

export function Pagination(props: PaginationProps) {
  const page = Math.max(1, Math.min(props.pageCount, props.page));
  return (
    <View class="flex-row items-center justify-between gap-2">
      <Button
        label="Prev"
        variant="outline"
        size="sm"
        onPress={() => props.onPageChange(Math.max(1, page - 1))}
      />
      <Text class="text-xs text-slate-400 font-bold">{`${page} / ${props.pageCount}`}</Text>
      <Button
        label="Next"
        variant="outline"
        size="sm"
        onPress={() => props.onPageChange(Math.min(props.pageCount, page + 1))}
      />
    </View>
  );
}
