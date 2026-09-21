/** Keep NativeScript Frame/Page views sized to the key window (SwiftUI embed). */
import type { Frame, Page } from "@nativescript/core";
import { syncEmbeddedRootLayout } from "./ios-embedded-layout";
import { rawPanelLogical } from "./ios-runtime-viewport";

declare const NativeScriptViewFactory: {
  initShared(): void;
  getKeyWindow?: () => UIWindow | null;
};

interface PocketSurfaceView extends UIView {
  logicalWidth: number;
  logicalHeight: number;
}

function keyWindowBounds(): CGRect | null {
  if (typeof NativeScriptViewFactory !== "undefined") {
    try {
      NativeScriptViewFactory.initShared();
      const key = NativeScriptViewFactory.getKeyWindow?.();
      if (key && key.bounds.size.width > 0 && key.bounds.size.height > 0) {
        return key.bounds;
      }
    } catch {
      // ignore
    }
  }
  return null;
}

function fillView(view: UIView, bounds: CGRect): void {
  const w = bounds.size.width;
  const h = bounds.size.height;
  const frame = view.frame;
  if (
    Math.abs(frame.origin.x) > 0.5 ||
    Math.abs(frame.origin.y) > 0.5 ||
    Math.abs(frame.size.width - w) > 0.5 ||
    Math.abs(frame.size.height - h) > 0.5
  ) {
    view.frame = bounds;
  }
  view.autoresizingMask = UIViewAutoresizing.FlexibleWidth | UIViewAutoresizing.FlexibleHeight;
  view.transform = CGAffineTransformIdentity;
}

export function syncNativeScriptShellToWindow(page: Page, frame: Frame): void {
  syncEmbeddedRootLayout();
  const bounds = keyWindowBounds();
  if (!bounds) {
    return;
  }

  const frameNative = frame.nativeViewProtected;
  if (frameNative) {
    fillView(frameNative, bounds);
    frameNative.layoutIfNeeded();
  }

  const pageNative = page.nativeViewProtected;
  if (pageNative) {
    fillView(pageNative, CGRectMake(0, 0, bounds.size.width, bounds.size.height));
    pageNative.layoutIfNeeded();
  }
}

export function logShellLayoutDiagnostics(page: Page, pocketNative: UIView | null): void {
  const panel = rawPanelLogical();
  const window = keyWindowBounds();
  const pageNative = page.nativeViewProtected;
  const parts: string[] = [
    `[pocket-home] shell window ${window ? Math.round(window.size.width) : 0}x${window ? Math.round(window.size.height) : 0}`,
    `panel ${panel.width}x${panel.height}`,
  ];
  if (pageNative) {
    const f = pageNative.frame;
    parts.push(
      `page frame ${Math.round(f.origin.x)},${Math.round(f.origin.y)} ${Math.round(f.size.width)}x${Math.round(f.size.height)}`,
    );
  }
  if (pocketNative) {
    const f = pocketNative.frame;
    const surface = pocketNative as PocketSurfaceView;
    parts.push(
      `surface frame ${Math.round(f.origin.x)},${Math.round(f.origin.y)} ${Math.round(f.size.width)}x${Math.round(f.size.height)} logical ${surface.logicalWidth}x${surface.logicalHeight}`,
    );
  }
  console.log(parts.join(" | "));
}
