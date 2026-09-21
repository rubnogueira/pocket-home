declare const NativeScriptViewFactory: {
  getKeyWindow?(): UIWindow | null;
};

export function publishShellSafeAreaInsets(): void {
  const fallback = { top: 0, bottom: 0, left: 0, right: 0 };
  let insets = fallback;

  if (typeof NativeScriptViewFactory !== "undefined" && NativeScriptViewFactory.getKeyWindow) {
    try {
      const window = NativeScriptViewFactory.getKeyWindow();
      if (window) {
        const sa = window.safeAreaInsets;
        insets = { top: sa.top, bottom: sa.bottom, left: sa.left, right: sa.right };
      }
    } catch {
      // Swift static not bridged — fall back below.
    }
  }

  if (insets === fallback) {
    const app = UIApplication.sharedApplication;
    const window = app.keyWindow ?? (app.windows.count > 0 ? app.windows.objectAtIndex(0) : null);
    if (window) {
      const sa = window.safeAreaInsets;
      insets = { top: sa.top, bottom: sa.bottom, left: sa.left, right: sa.right };
    }
  }

  (globalThis as { __POCKET_SHELL_INSETS?: typeof insets }).__POCKET_SHELL_INSETS = insets;
}
