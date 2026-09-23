/**
 * Bottom content inset published by the browser host (hosts/web/index.html): the band the
 * surface is drawn under but cannot be tapped in — the home indicator and a floating browser
 * toolbar. Scroll content extends its range by it and bottom-pinned controls sit above it, so
 * the page itself runs edge to edge. 0 on hosts that publish nothing (the iOS shell already
 * places its surface inside the safe area).
 */
import { ref, type Ref } from "vue";
import { onFrame } from "@pocketjs/framework/lifecycle";

export function contentInsetBottom(): number {
  const inset = (globalThis as { __pocketContentInsets?: { bottom?: number } })
    .__pocketContentInsets?.bottom;
  return typeof inset === "number" && inset > 0 ? Math.round(inset) : 0;
}

/** Reactive view of contentInsetBottom() (the host updates it on resize / rotation). */
export function useContentInsetBottom(): Ref<number> {
  const inset = ref(contentInsetBottom());
  onFrame(() => {
    const next = contentInsetBottom();
    if (next !== inset.value) inset.value = next;
  });
  return inset;
}
