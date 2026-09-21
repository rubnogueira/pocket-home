import { Dialog, DialogFooter } from "./Dialog.tsx";
import { Button } from "./Button.tsx";

export interface AlertDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function AlertDialog(props: AlertDialogProps) {
  return (
    <Dialog open={props.open} title={props.title} description={props.description}>
      <DialogFooter>
        <Button
          label={props.cancelLabel ?? "Cancel"}
          variant="outline"
          size="sm"
          onPress={props.onCancel}
        />
        <Button
          label={props.confirmLabel ?? "Continue"}
          variant="default"
          size="sm"
          onPress={props.onConfirm}
        />
      </DialogFooter>
    </Dialog>
  );
}
