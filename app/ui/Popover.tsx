import { Dialog } from "./Dialog.tsx";
import type { UiChildren } from "./children.ts";

export interface PopoverProps {
  open: boolean;
  title?: string;
  children?: UiChildren;
  onOpenChange: (open: boolean) => void;
}

export function Popover(props: PopoverProps) {
  return (
    <Dialog open={props.open} title={props.title} onOpenChange={props.onOpenChange}>
      {props.children}
    </Dialog>
  );
}
