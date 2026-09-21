/** Resize the SwiftUI-embedded NativeScript root to key-window bounds (native). */
declare const NativeScriptViewFactory: {
  initShared(): void;
  app: UIViewController | null;
};

declare const PocketEmbedPresenter: {
  syncEmbeddedRootLayout(): void;
};

export function syncEmbeddedRootLayout(): void {
  if (typeof PocketEmbedPresenter !== "undefined") {
    PocketEmbedPresenter.syncEmbeddedRootLayout();
    return;
  }
  if (typeof NativeScriptViewFactory === "undefined") {
    return;
  }
  NativeScriptViewFactory.initShared();
  const container = NativeScriptViewFactory.app;
  if (!container) {
    return;
  }
  const window = (
    NativeScriptViewFactory as { getKeyWindow?: () => UIWindow | null }
  ).getKeyWindow?.();
  const bounds = window?.bounds ?? container.view.bounds;
  if (bounds.size.width <= 0 || bounds.size.height <= 0) {
    setTimeout(() => syncEmbeddedRootLayout(), 50);
    return;
  }
  container.view.frame = bounds;
  for (let i = 0; i < container.childViewControllers.count; i++) {
    const child = container.childViewControllers.objectAtIndex(i) as UIViewController;
    child.view.frame = bounds;
    child.view.autoresizingMask =
      UIViewAutoresizing.FlexibleWidth | UIViewAutoresizing.FlexibleHeight;
    child.view.setNeedsLayout();
  }
  container.view.setNeedsLayout();
  container.view.layoutIfNeeded();
}

export function embeddedLayoutBoundsForPresent(): CGRect {
  NativeScriptViewFactory.initShared();
  const window = (
    NativeScriptViewFactory as { getKeyWindow?: () => UIWindow | null }
  ).getKeyWindow?.();
  if (window && window.bounds.size.width > 0) {
    return window.bounds;
  }
  const container = NativeScriptViewFactory.app;
  return container?.view.bounds ?? CGRectMake(0, 0, 0, 0);
}
