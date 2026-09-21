import type { PocketView } from "@nativescript/pocketjs";

/** Stop the pocket-apple display link / guest eval before replacing the surface. */
export function stopPocketNativeSurface(pocket: PocketView): void {
  const native = pocket.nativeViewProtected as { stop?: () => void } | null;
  if (native && typeof native.stop === "function") {
    try {
      native.stop();
    } catch (error) {
      console.warn("[pocket-home] native stop:", error);
    }
  }
}

/** UIKit sometimes leaves the surface offset after rotation — pin to the superview panel. */
export function pinPocketNativeToSuperview(pocket: PocketView): void {
  const native = pocket.nativeViewProtected;
  if (!native) {
    return;
  }
  const superview = native.superview;
  if (!superview) {
    return;
  }
  superview.layoutIfNeeded();
  native.layoutIfNeeded();
  const panel = superview.bounds;
  if (panel.size.width <= 0 || panel.size.height <= 0) {
    return;
  }
  const next = CGRectMake(0, 0, panel.size.width, panel.size.height);
  const frame = native.frame;
  if (
    Math.abs(frame.origin.x) > 0.5 ||
    Math.abs(frame.origin.y) > 0.5 ||
    Math.abs(frame.size.width - panel.size.width) > 0.5 ||
    Math.abs(frame.size.height - panel.size.height) > 0.5
  ) {
    native.frame = next;
  }
}
