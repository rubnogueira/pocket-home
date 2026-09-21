import type { Page } from "@nativescript/core";
import { deviceLogicalViewport } from "./ios-runtime-viewport";
import { syncEmbeddedRootLayout } from "./ios-embedded-layout";

type PocketNative = {
  nativeViewProtected?: UIView | null;
  requestLayout(): void;
  viewportWidth: number;
  viewportHeight: number;
};

function floorSize(width: number, height: number): { width: number; height: number } | null {
  if (width <= 0 || height <= 0) {
    return null;
  }
  return { width: Math.max(1, Math.floor(width)), height: Math.max(1, Math.floor(height)) };
}

function nativeFrameSize(native: UIView): { width: number; height: number } | null {
  native.layoutIfNeeded();
  return floorSize(native.frame.size.width, native.frame.size.height);
}

/** Window / scene logical size for the current orientation. */
export function orientedWindowLogical(): { width: number; height: number } {
  return deviceLogicalViewport();
}

/**
 * Logical size for pocket-apple. The window is authoritative for orientation;
 * use the surface's laid-out frame (not bounds — bounds can lie before layout).
 */
export function readPocketPanelLogical(
  page: Page,
  pocket: PocketNative,
): { width: number; height: number } {
  const target = orientedWindowLogical();
  syncEmbeddedRootLayout();
  page.requestLayout();
  pocket.requestLayout();

  const native = pocket.nativeViewProtected;
  if (native) {
    const fromFrame = nativeFrameSize(native);
    if (fromFrame && fromFrame.width === target.width && fromFrame.height === target.height) {
      return fromFrame;
    }
  }

  const pageSize = page.getActualSize();
  const fromPage = floorSize(pageSize.width, pageSize.height);
  if (fromPage && fromPage.width === target.width && fromPage.height === target.height) {
    return fromPage;
  }

  return target;
}

export function pocketViewportMatchesPanel(
  pocket: PocketNative,
  panel: { width: number; height: number },
): boolean {
  return pocket.viewportWidth === panel.width && pocket.viewportHeight === panel.height;
}

export function nativePanelMatchesTarget(
  pocket: PocketNative,
  target: { width: number; height: number },
): boolean {
  const native = pocket.nativeViewProtected;
  if (!native) {
    return false;
  }
  const frame = nativeFrameSize(native);
  if (!frame) {
    return false;
  }
  return Math.abs(frame.width - target.width) <= 2 && Math.abs(frame.height - target.height) <= 2;
}
