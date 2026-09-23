/**
 * SwiftUI embed: `@nativescript/core` presents the root controller by calling the embedder
 * delegate's `presentNativeScriptApp` from JS, but the Swift implementation is not exposed to
 * the JS metadata. Install an equivalent JS implementation before the runtime embeds the root.
 *
 * The container view is full-bleed (`NativeScriptApp.swift` ignores the safe area), so the
 * root only has to track the container's bounds via autoresizing — no manual re-sync.
 */
declare const NativeScriptEmbedder: {
  sharedInstance(): { delegate?: Record<string, unknown> };
};

declare const NativeScriptViewFactory: {
  initShared(): void;
  app: UIViewController | null;
};

function presentNativeScriptAppFromJs(vc: UIViewController): UIViewController | null {
  NativeScriptViewFactory.initShared();
  const container = NativeScriptViewFactory.app;
  if (!container) {
    return null;
  }
  vc.view.frame = container.view.bounds;
  vc.view.autoresizingMask = UIViewAutoresizing.FlexibleWidth | UIViewAutoresizing.FlexibleHeight;
  container.addChildViewController(vc);
  container.view.addSubview(vc.view);
  vc.didMoveToParentViewController(container);
  return container;
}

const delegate = NativeScriptEmbedder.sharedInstance().delegate;
if (delegate) {
  delegate.presentNativeScriptApp = (vc: UIViewController) => presentNativeScriptAppFromJs(vc);
}

export {};
