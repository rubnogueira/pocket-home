import { Screen } from "@nativescript/core";
import { getWindow } from "@nativescript/core/utils/native-helper";

declare const NativeScriptViewFactory: {
  initShared(): void;
  app: UIViewController | null;
  getKeyWindow?: () => UIWindow | null;
};

function floorSize(width: number, height: number): { width: number; height: number } | null {
  if (width <= 0 || height <= 0) {
    return null;
  }
  return { width: Math.max(1, Math.floor(width)), height: Math.max(1, Math.floor(height)) };
}

function resolveKeyWindow(): UIWindow | null {
  if (typeof NativeScriptViewFactory !== "undefined") {
    try {
      NativeScriptViewFactory.initShared();
      const key = NativeScriptViewFactory.getKeyWindow?.();
      if (key) {
        return key;
      }
    } catch {
      // Swift static not bridged — use getWindow().
    }
  }
  return getWindow<UIWindow>();
}

/** Key window bounds in DIPs — single source for guest logical size. */
export function rawPanelLogical(): { width: number; height: number } {
  const window = resolveKeyWindow();
  if (window) {
    const sized = floorSize(window.bounds.size.width, window.bounds.size.height);
    if (sized) {
      return sized;
    }
  }
  return {
    width: Math.max(1, Math.floor(Screen.mainScreen.widthDIPs)),
    height: Math.max(1, Math.floor(Screen.mainScreen.heightDIPs)),
  };
}

export function settledPanelLogical(): { width: number; height: number } {
  return rawPanelLogical();
}

/** @deprecated alias */
export function deviceLogicalViewport(): { width: number; height: number } {
  return rawPanelLogical();
}

export function runtimePocketLogical(): { width: number; height: number } {
  return rawPanelLogical();
}

export function sameRuntimeSize(
  a: { width: number; height: number },
  b: { width: number; height: number },
): boolean {
  return a.width === b.width && a.height === b.height;
}
