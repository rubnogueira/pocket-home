import { Modal, Text, View } from "@pocketjs/framework/components";
import type { UiChildren } from "./children.ts";
import { DIALOG_ACTIONS } from "./tokens.ts";

export interface DialogProps {
  open: boolean;
  title?: string;
  description?: string;
  children?: UiChildren;
  onOpenChange?: (open: boolean) => void;
}

export function Dialog(props: DialogProps) {
  return (
    <Modal
      open={props.open}
      panelClass="flex-col gap-2 w-[328] p-4 rounded-xl shadow-lg bg-slate-800 border-slate-700"
    >
      {props.title ? <Text class="text-lg text-slate-50 font-bold">{props.title}</Text> : null}
      {props.description ? <Text class="text-sm text-slate-400">{props.description}</Text> : null}
      {props.children}
    </Modal>
  );
}

export function DialogFooter(props: { children?: UiChildren }) {
  return <View class={DIALOG_ACTIONS}>{props.children}</View>;
}
