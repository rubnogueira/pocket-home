import { after } from "@pocketjs/framework/clock";

export function poll(intervalSeconds: number, callback: () => void): () => void {
  let cancelled = false;
  let cancel: (() => void) | undefined;

  function schedule(): void {
    if (cancelled) return;
    cancel = after(intervalSeconds, () => {
      if (cancelled) return;
      callback();
      schedule();
    });
  }

  schedule();

  return () => {
    cancelled = true;
    if (cancel) cancel();
  };
}
