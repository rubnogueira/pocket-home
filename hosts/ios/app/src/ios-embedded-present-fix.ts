/**
 * SwiftUI embed: the native `presentNativeScriptApp` selector is not invokable from JS.
 * Install a JS implementation on the embedder delegate before the runtime embeds the root.
 */
import { syncEmbeddedRootLayout, embeddedLayoutBoundsForPresent } from "./ios-embedded-layout";

declare const NativeScriptEmbedder: {
  sharedInstance(): { delegate?: Record<string, unknown> };
};

declare const NativeScriptViewFactory: {
  initShared(): void;
  app: UIViewController | null;
};

const CHROME = UIColor.colorWithRedGreenBlueAlpha(2 / 255, 6 / 255, 23 / 255, 1);

function presentNativeScriptAppFromJs(
  _delegate: unknown,
  vc: UIViewController,
): UIViewController | null {
  NativeScriptViewFactory.initShared();
  const container = NativeScriptViewFactory.app;
  if (!container) {
    return null;
  }
  const bounds = embeddedLayoutBoundsForPresent();
  vc.view.frame = bounds.size.width > 0 ? bounds : container.view.bounds;
  vc.view.autoresizingMask = UIViewAutoresizing.FlexibleWidth | UIViewAutoresizing.FlexibleHeight;
  vc.view.backgroundColor = CHROME;
  container.view.backgroundColor = CHROME;
  container.addChildViewController(vc);
  container.view.addSubview(vc.view);
  vc.didMoveToParentViewController(container);
  setTimeout(() => syncEmbeddedRootLayout(), 0);
  return container;
}

const embedder = NativeScriptEmbedder.sharedInstance();
const delegate = embedder.delegate;
if (delegate) {
  delegate.presentNativeScriptApp = (vc: UIViewController) =>
    presentNativeScriptAppFromJs(delegate, vc);
}
